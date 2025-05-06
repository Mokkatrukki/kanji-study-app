import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const router = Router();

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
 *                    example: "kuruma"
 *                  meaning:
 *                    type: string
 *                    example: "car"
 *                  compound_words:
 *                    type: array
 *                    items:
 *                      type: object
 *                      properties:
 *                        word: { type: string }
 *                        reading: { type: string }
 *                        meaning: { type: string }
 *                    example:
 *                      - { word: "電車", reading: "densha", meaning: "train (electric car)" }
 *                  example_sentences:
 *                    type: object
 *                    properties:
 *                      easy: { type: object, properties: { japanese: { type: string }, reading: { type: string }, translation: { type: string } } }
 *                      medium: { type: object, properties: { japanese: { type: string }, reading: { type: string }, translation: { type: string } } }
 *                      hard: { type: object, properties: { japanese: { type: string }, reading: { type: string }, translation: { type: string } } }
 *       400:
 *         description: Invalid input.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "Invalid input: \"kanji\" field is required..." }
 *       429:
 *         description: Too many requests (Rate Limit Exceeded).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "Too many requests from this IP..." }
 *       500:
 *         description: Internal server error or error fetching from OpenAI.
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

  // --- OpenAI API Call Logic ---
  try {
    const systemPrompt = `You are a Japanese learning assistant. You will receive one or more kanji and must respond with structured JSON. Output only valid JSON with no extra text. Follow the schema provided in the user prompt example. Ensure all readings are in romaji. Only include compound words that contain the input kanji as one of the written characters in the compound (e.g., if the input is 器, valid compounds include 食器 and 器官, but NOT 道具, since 器 is not in the written form). Only use the base kanji in the example sentences (no compound words). The response must be valid JSON.`;

    const userPrompt = `Input kanji: ${kanji}\n\nReturn ONLY JSON in this exact format (do not add any explanation or markdown):\n{\n  "kanji": "${kanji}",\n  "reading": "<romaji reading>",\n  "meaning": "<meaning>",\n  "compound_words": [\n    { "word": "<compound word 1>", "reading": "<reading 1>", "meaning": "<meaning 1>" },\n    { "word": "<compound word 2>", "reading": "<reading 2>", "meaning": "<meaning 2>" },\n    { "word": "<compound word 3>", "reading": "<reading 3>", "meaning": "<meaning 3>" },\n    { "word": "<compound word 4>", "reading": "<reading 4>", "meaning": "<meaning 4>" },\n    { "word": "<compound word 5>", "reading": "<reading 5>", "meaning": "<meaning 5>" }\n  ],\n  "example_sentences": {\n    "easy": {\n      "japanese": "<easy japanese sentence>",\n      "reading": "<easy romaji reading>",\n      "translation": "<easy translation>"\n    },\n    "medium": {\n      "japanese": "<medium japanese sentence>",\n      "reading": "<medium romaji reading>",\n      "translation": "<medium translation>"\n    },\n    "hard": {\n      "japanese": "<hard japanese sentence>",\n      "reading": "<hard romaji reading>",\n      "translation": "<hard translation>"\n    }\n  }\n}`;

    console.log("Sending request to OpenAI...");
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    console.log("Received response from OpenAI.");
    const jsonContent = completion.choices[0]?.message?.content;

    if (!jsonContent) {
      throw new Error("No content received from OpenAI.");
    }

    try {
      const parsedData = JSON.parse(jsonContent);
      console.log("Parsed data successfully.");
      res.status(200).json(parsedData);
    } catch (parseError) {
      console.error("Error parsing JSON from OpenAI:", parseError);
      console.error("Raw OpenAI content:", jsonContent);
      res.status(500).json({ error: "Failed to parse response from AI service.", raw_content: jsonContent });
    }

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    if (error instanceof OpenAI.APIError) {
      res.status(error.status || 500).json({ error: `OpenAI API Error: ${error.name}`, message: error.message });
    } else {
      res.status(500).json({ error: "An unexpected error occurred while contacting the AI service." });
    }
  }
  // ----------------------------
});

export default router; 