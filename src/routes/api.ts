import { Router, Request, Response } from 'express';
import { performance } from 'perf_hooks';

const router = Router();

// Helper function to parse Tatoeba's structured transcriptions
function parseTatoebaTranscription(transcription: string | null): Array<{ text: string, reading?: string }> {
    if (!transcription) {
        return [];
    }

    const segments: Array<{ text: string, reading?: string }> = [];
    // Regex to match [Kanji|Reading] parts or plain text parts
    // It captures bracketed parts and non-bracketed parts separately
    const regex = /(\[[^\|]+\|[^\\\]]+\])|([^\[\]]+)/g;
    let match;

    while ((match = regex.exec(transcription)) !== null) {
        if (match[1]) { // Bracketed part like [Kanji|Reading]
            const content = match[1].slice(1, -1); // Remove outer brackets
            const parts = content.split('|');
            const text = parts[0];
            const reading = parts.slice(1).join('').replace(/\|/g, ''); // Join if reading had '|', then remove all '|'
            if (text) { // Ensure text is not empty
                 segments.push({ text, reading });
            }
        } else if (match[2]) { // Plain text part
            const text = match[2];
            if (text.trim()) { // Ensure text is not just whitespace
                segments.push({ text });
            }
        }
    }
    return segments;
}

/**
 * @swagger
 * /api/kanji:
 *   post:
 *     summary: Generate Kanji study details
 *     tags: [Kanji]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - kanji
 *             properties:
 *               kanji:
 *                 type: string
 *                 description: The single Kanji character to get information for.
 *                 example: "車"
 *     responses:
 *       200:
 *         description: Successfully retrieved Kanji information.
 *         content:
 *           application/json:
 *             schema:
 *                type: object
 *                properties:
 *                  kanji:
 *                    type: string
 *                    example: "車"
 *                  reading:
 *                    type: string
 *                    description: Kana reading of the Kanji.
 *                    example: "くるま"
 *                  meaning:
 *                    type: string
 *                    example: "car"
 *                  compound_words:
 *                    type: array
 *                    items:
 *                      type: object
 *                      properties:
 *                        word: { type: string }
 *                        reading: { type: string, description: "Kana reading of the compound word." }
 *                        meaning: { type: string }
 *                    example:
 *                      - { word: "電車", reading: "でんしゃ", meaning: "train (electric car)" }
 *                  example_sentences:
 *                    type: array
 *                    description: Example sentences from Tatoeba.
 *                    items:
 *                      type: object
 *                      properties:
 *                        japanese: { type: string, description: "Japanese sentence." }
 *                        segments: 
 *                          type: array
 *                          description: "Parsed sentence segments for Furigana."
 *                          items:
 *                            type: object
 *                            properties:
 *                              text: { type: string, description: "Text segment (Kanji or Kana)." }
 *                              reading: { type: string, nullable: true, description: "Kana reading for the Kanji segment." }
 *                        translation: { type: string, description: "English translation." }
 *                    example:
 *                      - { japanese: "想像できる？", segments: [{text: "想像", reading: "そうぞう"}, {text: "できる？"}], translation: "Can you picture it?" }
 *       400:
 *         description: Invalid input.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "Invalid input: \"kanji\" field is required..." }
 *       404:
 *         description: Requested resource not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "Kanji not found." }
 *       500:
 *         description: Internal server error or error fetching from Jisho API.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "An unexpected error occurred..." }
 */
router.post('/kanji', async (req: Request, res: Response) => {
  console.log('Received kanji request:', req.body);
  const kanji = req.body.kanji as string;
  const encodedKanji = encodeURIComponent(kanji);

  // --- Input Validation ---
  if (!kanji || typeof kanji !== 'string') {
    return res.status(400).json({ error: 'Invalid input: "kanji" field is required and must be a string.' });
  }
  const kanjiRegex = /^[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]+$/;
  if (!kanjiRegex.test(kanji)) {
    return res.status(400).json({ error: 'Invalid input: Field must contain only Kanji characters.' });
  }
  if (kanji.length === 0 || kanji.length > 1) {
    return res.status(400).json({ error: 'Invalid input: Please provide 1 Kanji character.' });
  }
  // ------------------------

  let mainKanjiDetails: { kanji?: string, reading?: string, meaning?: string, mainMeaningForFilter?: string } = {};
  let compoundWordsList: any[] = [];

  // --- Fetch Kanji Details from kanjiapi.dev ---
  try {
    const kanjiDetailUrl = `https://kanjiapi.dev/v1/kanji/${encodedKanji}`;
    const kanjiDetailResponse = await fetch(kanjiDetailUrl);

    if (!kanjiDetailResponse.ok) {
      throw new Error(`kanjiapi.dev (detail) failed with status: ${kanjiDetailResponse.status}`);
    }
    const data = await kanjiDetailResponse.json();

    mainKanjiDetails.kanji = data.kanji;
    mainKanjiDetails.reading = 
      (data.kun_readings && data.kun_readings.length > 0 ? data.kun_readings[0] : null) ||
      (data.on_readings && data.on_readings.length > 0 ? data.on_readings[0] : null) ||
      "N/A";
    
    if (data.meanings && data.meanings.length > 0) {
      mainKanjiDetails.meaning = data.meanings.join(', ');
      mainKanjiDetails.mainMeaningForFilter = data.meanings[0]?.toLowerCase();
    } else {
      mainKanjiDetails.meaning = "N/A";
      mainKanjiDetails.mainMeaningForFilter = undefined;
    }

  } catch (error: any) {
    console.error(`Error fetching Kanji details from kanjiapi.dev for ${kanji}:`, error.message);
    return res.status(500).json({ error: "Failed to fetch Kanji details.", details: error.message });
  }
  // -------------------------------------------

  // --- Fetch Compound Words from kanjiapi.dev ---
  if (mainKanjiDetails.kanji) {
    try {
      const wordsUrl = `https://kanjiapi.dev/v1/words/${encodedKanji}`;
      const wordsResponse = await fetch(wordsUrl);

      if (!wordsResponse.ok) {
        throw new Error(`kanjiapi.dev (words) failed with status: ${wordsResponse.status}`);
      }
      const wordsData = await wordsResponse.json(); 

      if (Array.isArray(wordsData)) {
        const preferredCompounds: any[] = [];
        const otherPriorityCompounds: any[] = [];
        const preferredTags = [/^news[12]$/, /^nf0[1-9]$/, /^nf1[0-5]$/]; 

        for (const wordEntry of wordsData) {
          if (preferredCompounds.length >= 5) break; 
          if (wordEntry.variants && Array.isArray(wordEntry.variants)) {
            for (const variant of wordEntry.variants) {
              if (preferredCompounds.length + otherPriorityCompounds.length >= 10) break; 
              const written = variant.written;
              const pronounced = variant.pronounced;
              const gloss = wordEntry.meanings && wordEntry.meanings[0] && wordEntry.meanings[0].glosses && wordEntry.meanings[0].glosses[0];
              if (written && pronounced && gloss) {
                if (written === mainKanjiDetails.kanji) continue;
                if (!written.includes(kanji)) continue;
                if (written.length > 4) continue;
                if (mainKanjiDetails.mainMeaningForFilter && gloss.toLowerCase() === mainKanjiDetails.mainMeaningForFilter) continue;
                const hasPriority = variant.priorities && variant.priorities.length > 0;
                if (!hasPriority) continue; 
                let isPreferred = false;
                if (hasPriority) {
                  for (const tagPattern of preferredTags) {
                    if (variant.priorities.some((p: string) => tagPattern.test(p))) {
                      isPreferred = true;
                      break;
                    }
                  }
                }
                const compound = { word: written, reading: pronounced, meaning: gloss };
                if (isPreferred && preferredCompounds.length < 5) {
                  preferredCompounds.push(compound);
                } else if (otherPriorityCompounds.length < 5) { 
                  otherPriorityCompounds.push(compound);
                }
              }
            }
          }
        }
        const combined = [...preferredCompounds, ...otherPriorityCompounds];
        const uniqueCompounds = Array.from(new Map(combined.map(item => [item.word, item])).values());
        compoundWordsList = uniqueCompounds; 
      }
    } catch (error: any) {
      console.error(`Error fetching compound words from kanjiapi.dev for ${kanji}:`, error.message);
    }
  }
  // --------------------------------------------

  const responseData = {
    kanji: mainKanjiDetails.kanji || kanji,
    reading: mainKanjiDetails.reading || "N/A",
    meaning: mainKanjiDetails.meaning || "N/A",
    compound_words: compoundWordsList.slice(0, 5),
    example_sentences: [] 
  };

  // --- Fetch Example Sentences from Tatoeba --- 
  try {
    const tatoebaQuery = encodeURIComponent(kanji);
    const tatoebaUrl = `https://api.tatoeba.org/unstable/sentences?lang=jpn&q=${tatoebaQuery}&trans:lang=eng&trans:is_direct=yes&limit=5&sort=random&word_count=5-14`;
    const tatoebaResponse = await fetch(tatoebaUrl);

    if (tatoebaResponse.ok) {
      const tatoebaData = await tatoebaResponse.json();

      if (tatoebaData.data && tatoebaData.data.length > 0) {
        responseData.example_sentences = tatoebaData.data.map((item: any) => {
          let japaneseSentence = item.text || "";
          let englishTranslation = "";
          let sentenceSegments: Array<{ text: string, reading?: string }> = [];

          if (item.translations && Array.isArray(item.translations)) {
            let foundDirectEnglish = false;
            for (const group of item.translations) {
              if (Array.isArray(group)) {
                const directEng = group.find((t: any) => t.lang === 'eng' && t.isDirect);
                if (directEng) {
                  englishTranslation = directEng.text;
                  foundDirectEnglish = true;
                  break;
                }
              }
            }
            if (!foundDirectEnglish) {
              for (const group of item.translations) {
                if (Array.isArray(group)) {
                  const anyEng = group.find((t: any) => t.lang === 'eng');
                  if (anyEng) {
                    englishTranslation = anyEng.text;
                    break;
                  }
                }
              }
            }
          }
          if (item.transcriptions && item.transcriptions.length > 0) {
            const hiraganaTranscription = item.transcriptions.find((t: any) => t.script === 'Hrkt');
            if (hiraganaTranscription && hiraganaTranscription.text) {
              sentenceSegments = parseTatoebaTranscription(hiraganaTranscription.text);
            } else if (item.transcriptions[0] && item.transcriptions[0].text) {
              sentenceSegments = parseTatoebaTranscription(item.transcriptions[0].text);
            }
          }
          return { japanese: japaneseSentence, segments: sentenceSegments, translation: englishTranslation };
        }).filter((s: any) => s.japanese && s.translation && s.segments.length > 0);
      }
    } else {
      console.warn(`Tatoeba API (unstable) request failed with status: ${tatoebaResponse.status}, body: ${await tatoebaResponse.text()}`);
    }
  } catch (tatoebaError: any) {
    console.error("Error fetching or parsing from Tatoeba API:", tatoebaError.message);
  }
  // -----------------------------------------

  res.status(200).json(responseData);
});

export default router; 