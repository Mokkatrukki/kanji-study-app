import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import NodeCache from 'node-cache';
import JishoAPI from 'unofficial-jisho-api';

const router = Router();

// Initialize cache with a default TTL (e.g., 1 hour = 3600 seconds)
// and checkperiod (e.g., 10 minutes = 600 seconds) to automatically delete expired items
const kanjiCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Initialize Jisho API client
const jisho = new JishoAPI();

// --- Initialize OpenAI Client ---
// Ensure OPENAI_API_KEY is set in your root .env file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// -------------------------------

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

  const kanji = req.body.kanji;

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

  // --- Check Cache ---
  const cachedData = kanjiCache.get(kanji);
  if (cachedData) {
    console.log(`Cache hit for kanji: ${kanji}`);
    return res.status(200).json(cachedData);
  }
  console.log(`Cache miss for kanji: ${kanji}`);
  // -------------------

  // --- Jisho API Call Logic ---
  try {
    console.log(`Attempting to fetch Kanji data from Jisho for: ${kanji}`);
    const jishoData = await jisho.searchForKanji(kanji);

    if (jishoData && jishoData.found) {
      console.log(`Jisho data found for: ${kanji}`);
      
      const mainKanjiMeaning = jishoData.meaning ? jishoData.meaning.toLowerCase() : null;

      const primaryReading = (jishoData.kunyomi && jishoData.kunyomi.length > 0 ? jishoData.kunyomi[0] : null) ||
                           (jishoData.onyomi && jishoData.onyomi.length > 0 ? jishoData.onyomi[0] : null) ||
                           "N/A";

      const combinedExamples = [
        ...(jishoData.kunyomiExamples || []),
        ...(jishoData.onyomiExamples || [])
      ];

      const compound_words = combinedExamples
        .filter(ex => {
          const isNotInputKanjiItself = ex.example !== kanji;
          const exampleMeaning = ex.meaning ? ex.meaning.toLowerCase() : null;
          // Keep if meaning is different from main Kanji, or if meanings can't be compared (one is null)
          const isMeaningDifferentOrUndefined = !mainKanjiMeaning || !exampleMeaning || exampleMeaning !== mainKanjiMeaning;
          return isNotInputKanjiItself && isMeaningDifferentOrUndefined;
        })
        .map(ex => ({
          word: ex.example,
          reading: ex.reading, // Kana reading from Jisho
          meaning: ex.meaning
        }))
        .slice(0, 5); // Limit to 5 compounds

      const responseData = {
        kanji: jishoData.query || kanji,
        reading: primaryReading,
        meaning: jishoData.meaning || "N/A",
        compound_words: compound_words,
        example_sentences: [] // Initialize as empty array
      };

      // --- Fetch Example Sentences from Tatoeba ---
      try {
        const tatoebaQuery = encodeURIComponent(kanji);
        // Corrected hostname to api.tatoeba.org and using /unstable/sentences endpoint, added sort parameter
        const tatoebaUrl = `https://api.tatoeba.org/unstable/sentences?lang=jpn&q=${tatoebaQuery}&trans:lang=eng&trans:is_direct=yes&limit=5&sort=relevance`;
        console.log(`Fetching example sentences from Tatoeba (api.tatoeba.org): ${tatoebaUrl}`);
        const tatoebaResponse = await fetch(tatoebaUrl);

        if (tatoebaResponse.ok) {
          const tatoebaData = await tatoebaResponse.json();
          // Adjusted to look for results in tatoebaData.data as per the new example
          if (tatoebaData.data && tatoebaData.data.length > 0) {
            responseData.example_sentences = tatoebaData.data.map((item: any) => {
              let japaneseSentence = item.text || "";
              let englishTranslation = "";
              let sentenceReading = null; 

              // Iterate through all translation groups and then translations within each group
              if (item.translations && Array.isArray(item.translations)) {
                let foundDirectEnglish = false;
                for (const group of item.translations) {
                  if (Array.isArray(group)) {
                    const directEng = group.find((t: any) => t.lang === 'eng' && t.isDirect);
                    if (directEng) {
                      englishTranslation = directEng.text;
                      foundDirectEnglish = true;
                      break; // Found direct English, no need to search further
                    }
                  }
                }
                // Fallback: if no direct English translation was found, search for any English translation
                if (!foundDirectEnglish) {
                  for (const group of item.translations) {
                    if (Array.isArray(group)) {
                      const anyEng = group.find((t: any) => t.lang === 'eng');
                      if (anyEng) {
                        englishTranslation = anyEng.text;
                        break; // Found an English translation, use it
                      }
                    }
                  }
                }
              }
              
              // Attempt to get a reading (simplified for now)
              if (item.transcriptions && item.transcriptions.length > 0) {
                const hiraganaTranscription = item.transcriptions.find((t: any) => t.script === 'Hrkt');
                if (hiraganaTranscription && hiraganaTranscription.text) {
                    // Basic cleanup: remove original kanji and brackets if pattern is [Kanji|Reading]
                    // This is a simplification and might need refinement.
                    sentenceReading = hiraganaTranscription.text.replace(/\[[^\|]+\|([^\]]+)\]/g, '$1').replace(/[\s\[\]]/g, '');
                } else if (item.transcriptions[0] && item.transcriptions[0].text) {
                    // Fallback to first transcription if no Hrkt found
                    sentenceReading = item.transcriptions[0].text.replace(/\[[^\|]+\|([^\]]+)\]/g, '$1').replace(/[\s\[\]]/g, '');
                }
              }

              return {
                japanese: japaneseSentence,
                reading: sentenceReading,
                translation: englishTranslation,
              };
            }).filter((s:any) => s.japanese && s.translation); 
          }
        } else {
          console.warn(`Tatoeba API (unstable) request failed with status: ${tatoebaResponse.status}`);
        }
      } catch (tatoebaError) {
        console.error("Error fetching or parsing from Tatoeba API:", tatoebaError);
        // Keep example_sentences as empty array or handle as needed
      }
      // -----------------------------------------

      kanjiCache.set(kanji, responseData);
      console.log(`Stored Jisho response for ${kanji} in cache.`);
      return res.status(200).json(responseData);
    } else {
      console.log(`Kanji not found on Jisho for: ${kanji}.`);
      return res.status(404).json({ error: `Kanji "${kanji}" not found by Jisho API.` });
    }
  } catch (jishoError) {
    console.error(`Error fetching from Jisho for ${kanji}:`, jishoError);
    return res.status(500).json({ error: "Error fetching data from Jisho API.", details: jishoError instanceof Error ? jishoError.message : String(jishoError) });
  }
  // -------------------------
});

export default router; 