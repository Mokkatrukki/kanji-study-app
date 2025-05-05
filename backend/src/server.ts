import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger'; // Import the swagger config

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

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
 *         description: Successfully retrieved Kanji information (placeholder).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Received kanji: 車"
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   example: null
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
 */
app.post('/api/kanji', (req: Request, res: Response) => {
  console.log('Received kanji request:', req.body);

  // TODO: Add input validation
  // TODO: Call OpenAI API
  // TODO: Send response back

  const kanji = req.body.kanji;

  // Basic validation placeholder
  if (!kanji || typeof kanji !== 'string') {
    res.status(400).json({ error: 'Invalid input: "kanji" field is required and must be a string.' });
    return;
  }

  // Placeholder response
  res.json({ message: `Received kanji: ${kanji}`, data: null }); // Placeholder
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 