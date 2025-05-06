import { Router, Request, Response } from 'express';
import NodeCache from 'node-cache';
// import JishoAPI from 'unofficial-jisho-api'; // Removed Jisho
import { performance } from 'perf_hooks';

const router = Router();

// Initialize cache with a default TTL (e.g., 1 hour = 3600 seconds)
// and checkperiod (e.g., 10 minutes = 600 seconds) to automatically delete expired items
const kanjiCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// const jisho = new JishoAPI(); // Removed Jisho

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
 *                 description: The Kanji character(s) to get information for.
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
 *                        reading: { type: string, nullable: true, description: "Romaji or Kana reading of the sentence (if available)." }
 *                        translation: { type: string, description: "English translation." }
 *                    example:
 *                      - { japanese: "想像できる？", reading: "そうぞうできる？", translation: "Can you picture it?" }
 *       400:
 *         description: Invalid input.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "Invalid input: \"kanji\" field is required..." }
 *       404:
 *         description: Kanji not found by the Jisho API.
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
  if (kanji.length === 0 || kanji.length > 3) {
    return res.status(400).json({ error: 'Invalid input: Please provide 1 to 3 Kanji characters.' });
  }
  // ------------------------

  const cachedData = kanjiCache.get(kanji);
  if (cachedData) {
    console.log(`Cache hit for kanji: ${kanji}`);
    return res.status(200).json(cachedData);
  }
  console.log(`Cache miss for kanji: ${kanji}`);

  let mainKanjiDetails: { kanji?: string, reading?: string, meaning?: string, mainMeaningForFilter?: string } = {};
  let compoundWordsList: any[] = [];

  // const overallKanjiApiTimingStart = performance.now(); // Remove

  // --- Fetch Kanji Details from kanjiapi.dev ---
  try {
    const kanjiDetailUrl = `https://kanjiapi.dev/v1/kanji/${encodedKanji}`;
    // console.log(`Fetching Kanji details from ${kanjiDetailUrl}`); // Remove
    // const kanjiDetailFetchStart = performance.now(); // Remove
    const kanjiDetailResponse = await fetch(kanjiDetailUrl);
    // const kanjiDetailFetchEnd = performance.now(); // Remove
    // console.log(`kanjiapi.dev (detail) fetch for "${kanji}" took ${(kanjiDetailFetchEnd - kanjiDetailFetchStart).toFixed(2)} ms.`); // Remove

    if (!kanjiDetailResponse.ok) {
      throw new Error(`kanjiapi.dev (detail) failed with status: ${kanjiDetailResponse.status}`);
    }
    // const kanjiDetailParseStart = performance.now(); // Remove
    const data = await kanjiDetailResponse.json();
    // const kanjiDetailParseEnd = performance.now(); // Remove
    // console.log(`kanjiapi.dev (detail) parse for "${kanji}" took ${(kanjiDetailParseEnd - kanjiDetailParseStart).toFixed(2)} ms.`); // Remove

    mainKanjiDetails.kanji = data.kanji;
    mainKanjiDetails.reading = 
      (data.kun_readings && data.kun_readings.length > 0 ? data.kun_readings[0] : null) ||
      (data.on_readings && data.on_readings.length > 0 ? data.on_readings[0] : null) ||
      "N/A";
    mainKanjiDetails.meaning = (data.meanings && data.meanings.length > 0 ? data.meanings[0] : "N/A");
    mainKanjiDetails.mainMeaningForFilter = mainKanjiDetails.meaning?.toLowerCase();

  } catch (error: any) {
    // const kanjiDetailFetchEnd = performance.now(); // Remove, or adjust error timing if still desired without success path logs
    console.error(`Error fetching Kanji details from kanjiapi.dev for ${kanji}:`, error.message); // Keep error log
    // console.log(`kanjiapi.dev (detail) call for "${kanji}" (failed) took at least ... ms before error.`); // Remove or simplify
    return res.status(500).json({ error: "Failed to fetch Kanji details.", details: error.message });
  }
  // -------------------------------------------

  // --- Fetch Compound Words from kanjiapi.dev ---
  if (mainKanjiDetails.kanji) {
    try {
      const wordsUrl = `https://kanjiapi.dev/v1/words/${encodedKanji}`;
      // console.log(`Fetching compound words from ${wordsUrl}`); // Remove
      // const wordsFetchStart = performance.now(); // Remove
      const wordsResponse = await fetch(wordsUrl);
      // const wordsFetchEnd = performance.now(); // Remove
      // console.log(`kanjiapi.dev (words) fetch for "${kanji}" took ... ms.`); // Remove

      if (!wordsResponse.ok) {
        throw new Error(`kanjiapi.dev (words) failed with status: ${wordsResponse.status}`);
      }
      // const wordsParseStart = performance.now(); // Remove
      const wordsData = await wordsResponse.json(); 
      // const wordsParseEnd = performance.now(); // Remove
      // console.log(`kanjiapi.dev (words) parse for "${kanji}" took ... ms.`); // Remove

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
      // const wordsFetchEnd = performance.now(); // Remove or adjust
      console.error(`Error fetching compound words from kanjiapi.dev for ${kanji}:`, error.message); // Keep error log
      // console.log(`kanjiapi.dev (words) call for "${kanji}" (failed or partially failed) ... ms before error.`); // Remove or simplify
    }
  }
  // --------------------------------------------
  // const overallKanjiApiTimingEnd = performance.now(); // Remove
  // console.log(`kanjiapi.dev calls for "${kanji}" (total) took ... ms.`); // Remove

  const responseData = {
    kanji: mainKanjiDetails.kanji || kanji,
    reading: mainKanjiDetails.reading || "N/A",
    meaning: mainKanjiDetails.meaning || "N/A",
    compound_words: compoundWordsList.slice(0, 5),
    example_sentences: [] 
  };

  // --- Fetch Example Sentences from Tatoeba --- 
  try {
    // const tatoebaStartTime = performance.now(); // Remove
    const tatoebaQuery = encodeURIComponent(kanji);
    const tatoebaUrl = `https://api.tatoeba.org/unstable/sentences?lang=jpn&q=${tatoebaQuery}&trans:lang=eng&trans:is_direct=yes&limit=5&sort=relevance`;
    // console.log(`Fetching example sentences from Tatoeba (api.tatoeba.org): ${tatoebaUrl}`); // Remove (can be verbose)
    const tatoebaResponse = await fetch(tatoebaUrl);
    // const tatoebaFetchEnd = performance.now(); // Remove
    // console.log(`Tatoeba API call for "${kanji}" (fetch) took ... ms.`); // Remove

    if (tatoebaResponse.ok) {
      // const tatoebaParseStartTime = performance.now(); // Remove
      const tatoebaData = await tatoebaResponse.json();
      // const tatoebaParseEndTime = performance.now(); // Remove
      // console.log(`Tatoeba API call for "${kanji}" (json parsing) took ... ms.`); // Remove

      if (tatoebaData.data && tatoebaData.data.length > 0) {
        responseData.example_sentences = tatoebaData.data.map((item: any) => {
          let japaneseSentence = item.text || "";
          let englishTranslation = "";
          let sentenceReading = null;
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
              sentenceReading = hiraganaTranscription.text.replace(/\[[^\|]+\|([^\]]+)\]/g, '$1').replace(/[\s\[\]]/g, '');
            } else if (item.transcriptions[0] && item.transcriptions[0].text) {
              sentenceReading = item.transcriptions[0].text.replace(/\[[^\|]+\|([^\]]+)\]/g, '$1').replace(/[\s\[\]]/g, '');
            }
          }
          return { japanese: japaneseSentence, reading: sentenceReading, translation: englishTranslation };
        }).filter((s: any) => s.japanese && s.translation);
      }
    } else {
      console.warn(`Tatoeba API (unstable) request failed with status: ${tatoebaResponse.status}, body: ${await tatoebaResponse.text()}`); // Keep warning
    }
  } catch (tatoebaError: any) {
    // const tatoebaEndTime = performance.now(); // Remove or adjust
    console.error("Error fetching or parsing from Tatoeba API:", tatoebaError.message); // Keep error log
    // console.log(`Tatoeba API call for "${kanji}" (failed) took at least ... ms before error.`); // Remove or simplify
  }
  // -----------------------------------------

  kanjiCache.set(kanji, responseData);
  console.log(`Stored final response for ${kanji} in cache.`); // Keep this
  res.status(200).json(responseData);
});

export default router; 