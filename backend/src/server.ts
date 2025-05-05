import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger'; // Import the swagger config
import OpenAI from 'openai'; // Import OpenAI client
import rateLimit from 'express-rate-limit'; // Import express-rate-limit

// Load environment variables from .env file
dotenv.config();

// --- Initialize OpenAI Client ---
// Make sure OPENAI_API_KEY is set in your .env file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// -------------------------------

const app = express();
const port = process.env.PORT || 3001;

// --- Rate Limiter Setup ---
// Apply to all requests starting with /api/
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `windowMs`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes', // Message to send when limit is exceeded
});
app.use('/api', limiter); // Apply the limiter to /api routes
// ------------------------

// Middleware to parse JSON bodies
app.use(express.json());

// Serve Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Placeholder for the main API endpoint

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
 *                # Using a reference to a schema definition (we can define this later or keep it inline)
 *                # For now, just indicating a successful object response.
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
 *                        word:
 *                          type: string
 *                        reading:
 *                          type: string
 *                        meaning:
 *                          type: string
 *                    example:
 *                      - { word: "電車", reading: "densha", meaning: "train (electric car)" }
 *                      # ... other examples
 *                  example_sentences:
 *                    type: object
 *                    properties:
 *                      easy:
 *                         type: object
 *                         properties:
 *                           japanese: { type: string }
 *                           reading: { type: string }
 *                           translation: { type: string }
 *                      medium:
 *                         type: object
 *                         properties:
 *                           japanese: { type: string }
 *                           reading: { type: string }
 *                           translation: { type: string }
 *                      hard:
 *                         type: object
 *                         properties:
 *                           japanese: { type: string }
 *                           reading: { type: string }
 *                           translation: { type: string }
 *       400:
 *         description: Invalid input.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid input: \"kanji\" field is required and must be a string."
 *       500:
 *         description: Internal server error or error fetching from OpenAI.
 */
// Make the route handler async to use await
app.post('/api/kanji', async (req: Request, res: Response) => {
  console.log('Received kanji request:', req.body);

  const kanji = req.body.kanji;

  // --- Input Validation ---
  if (!kanji || typeof kanji !== 'string') {
    res.status(400).json({ error: 'Invalid input: "kanji" field is required and must be a string.' });
    return;
  }

  // Check for Kanji-only characters (using a broad CJK Unified Ideographs range)
  // This regex checks if the string contains ONLY characters in the ranges:
  // U+4E00 to U+9FFF (Common CJK Unified Ideographs)
  // U+3400 to U+4DBF (CJK Unified Ideographs Extension A)
  // U+F900 to U+FAFF (CJK Compatibility Ideographs)
  // Note: This is a common approach but might not cover every single obscure Kanji.
  // It also allows multiple kanji.
  const kanjiRegex = /^[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]+$/;
  if (!kanjiRegex.test(kanji)) {
    res.status(400).json({ error: 'Invalid input: Field must contain only Kanji characters.' });
    return;
  }

  // Limit input length (e.g., 1 to 3 Kanji)
  if (kanji.length === 0 || kanji.length > 3) {
    res.status(400).json({ error: 'Invalid input: Please provide 1 to 3 Kanji characters.' });
    return;
  }
  // ------------------------

  // --- OpenAI API Call Logic ---
  try {
    const systemPrompt = `You are a Japanese learning assistant. You will receive one or more kanji and must respond with structured JSON. Output only valid JSON with no extra text. Follow the schema provided in the user prompt example. Ensure all readings are in romaji. Only use the base kanji in the example sentences (no compound words). The response must be valid JSON.`;

    // Using the example structure from the plan in the user prompt
    const userPrompt = `Input kanji: ${kanji}

Return ONLY JSON in this exact format (do not add any explanation or markdown):
{
  "kanji": "${kanji}",
  "reading": "<romaji reading>",
  "meaning": "<meaning>",
  "compound_words": [
    { "word": "<compound word 1>", "reading": "<reading 1>", "meaning": "<meaning 1>" },
    { "word": "<compound word 2>", "reading": "<reading 2>", "meaning": "<meaning 2>" },
    { "word": "<compound word 3>", "reading": "<reading 3>", "meaning": "<meaning 3>" },
    { "word": "<compound word 4>", "reading": "<reading 4>", "meaning": "<meaning 4>" },
    { "word": "<compound word 5>", "reading": "<reading 5>", "meaning": "<meaning 5>" }
  ],
  "example_sentences": {
    "easy": {
      "japanese": "<easy japanese sentence>",
      "reading": "<easy romaji reading>",
      "translation": "<easy translation>"
    },
    "medium": {
      "japanese": "<medium japanese sentence>",
      "reading": "<medium romaji reading>",
      "translation": "<medium translation>"
    },
    "hard": {
      "japanese": "<hard japanese sentence>",
      "reading": "<hard romaji reading>",
      "translation": "<hard translation>"
    }
  }
}`;

    console.log("Sending request to OpenAI...");
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Or use "gpt-4" etc.
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" }, // Request JSON response
      // max_tokens: 1000, // Optional: Limit response size
      // temperature: 0.5, // Optional: Adjust creativity (lower is more focused)
    });

    console.log("Received response from OpenAI.");
    const jsonContent = completion.choices[0]?.message?.content;

    if (!jsonContent) {
      throw new Error("No content received from OpenAI.");
    }

    try {
       // Parse the JSON string from the API response
      const parsedData = JSON.parse(jsonContent);
      console.log("Parsed data successfully.");
      res.status(200).json(parsedData); // Send the parsed data back
    } catch (parseError) {
      console.error("Error parsing JSON from OpenAI:", parseError);
      console.error("Raw OpenAI content:", jsonContent);
      res.status(500).json({ error: "Failed to parse response from AI service.", raw_content: jsonContent });
    }

  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    // Basic error handling - could be more specific based on error type
    if (error instanceof OpenAI.APIError) {
        res.status(error.status || 500).json({ error: `OpenAI API Error: ${error.name}`, message: error.message });
    } else {
        res.status(500).json({ error: "An unexpected error occurred while contacting the AI service." });
    }
  }
  // ----------------------------

});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 