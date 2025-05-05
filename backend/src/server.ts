import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware to parse JSON bodies
app.use(express.json());

// Placeholder for the main API endpoint
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