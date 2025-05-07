import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';
import swaggerSpec from './swagger'; // Import the swagger config
import apiRoutes from './routes/api'; // Import API routes
// import fetch from 'node-fetch'; // Removed to use global fetch

// Load environment variables from .env file at the root
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// --- View Engine Setup ---
// Use EJS as the template engine
app.set('view engine', 'ejs');
// Set the directory where template files are located
// Use path.join to create an absolute path
app.set('views', path.join(__dirname, 'views'));

// --- Middleware ---
// Rate Limiter (Apply before other routes)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `windowMs`
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api', limiter); // Apply the limiter only to /api routes

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files (CSS, JS, images) from the 'public' directory
// Use path.join to create an absolute path
app.use(express.static(path.join(__dirname, 'public')));

// --- Routes ---
// Serve Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use('/api', apiRoutes);

// Root route to render the main page using EJS
app.get('/', async (req, res) => {
  let metaTitle = "Kanji Study Helper";
  let metaDescription = "Explore Japanese Kanji: meanings, readings, compounds, and example sentences. A simple tool to aid your Japanese language studies.";
  // Construct the full URL for metaUrl
  // Ensure req.protocol is correctly determined (e.g., behind a proxy)
  // If you have a fixed domain, you might want to use that directly.
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  let metaUrl = `${protocol}://${host}${req.originalUrl}`;
  
  // Default image - replace with your actual image URL hosted in /public or elsewhere
  // For example, if you have public/images/default-preview.png, it would be /images/default-preview.png
  let metaImage = "/images/default-preview.png"; // Placeholder - MAKE SURE THIS IMAGE EXISTS or remove/change

  const kanjiQuery = req.query.kanji as string;

  if (kanjiQuery) {
    try {
      const encodedKanji = encodeURIComponent(kanjiQuery.substring(0, 1)); // Use only the first character for the meta preview
      const kanjiDetailUrl = `https://kanjiapi.dev/v1/kanji/${encodedKanji}`;
      
      // console.log(`Fetching meta details from ${kanjiDetailUrl}`); // For debugging
      const response = await fetch(kanjiDetailUrl);

      if (response.ok) {
        const data = await response.json() as any; // Type assertion for simplicity
        const mainMeaning = data.meanings && data.meanings.length > 0 ? data.meanings[0] : '';
        const primaryReading = (data.kun_readings && data.kun_readings.length > 0 ? data.kun_readings[0] : (data.on_readings && data.on_readings.length > 0 ? data.on_readings[0] : ''));
        
        if (data.kanji) {
          metaTitle = `Kanji: ${data.kanji} - Kanji Study Helper`;
          let descriptionParts: string[] = [];
          if (primaryReading) descriptionParts.push(`Reading: ${primaryReading}`);
          if (mainMeaning) descriptionParts.push(`Meaning: ${mainMeaning}`);
          descriptionParts.push("Explore compounds and sentences.");
          metaDescription = descriptionParts.join(' | ');
          // Potentially set a dynamic metaImage here if you generate images per Kanji
          // metaImage = `/images/kanji/${data.kanji}.png`; // Example
        } else {
          // Kanji character itself not found in response, use query or default
          metaTitle = `Kanji: ${kanjiQuery} - Kanji Study Helper`;
          metaDescription = `Find information about the Kanji "${kanjiQuery}" and related vocabulary on Kanji Study Helper.`;
        }
      } else {
        // API error or Kanji not found, use a slightly more specific message
        console.warn(`Meta fetch: kanjiapi.dev call for "${encodedKanji}" failed with status: ${response.status}`);
        metaTitle = `Kanji: ${kanjiQuery} - Kanji Study Helper`;
        metaDescription = `Information for Kanji "${kanjiQuery}" on Kanji Study Helper. External data could not be loaded.`;
      }
    } catch (error) {
      console.error("Error fetching Kanji details for meta tags:", error);
      // Fallback to a generic message if an error occurs during fetch
      metaTitle = `Kanji: ${kanjiQuery} - Kanji Study Helper`;
      metaDescription = `An error occurred while fetching details for Kanji "${kanjiQuery}". Please try exploring on the site.`;
    }
  }

  // Render the index.ejs template from the views directory
  res.render('index', {
    metaTitle,
    metaDescription,
    metaUrl,
    metaImage,
    // any other variables your template might need from the original setup
    // title: metaTitle, // If your template previously used a 'title' variable directly, ensure it's consistent
  });
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`API Docs available at http://localhost:${port}/api-docs`);
}); 