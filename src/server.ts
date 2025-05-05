import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import rateLimit from 'express-rate-limit';
import swaggerSpec from './swagger'; // Import the swagger config
import apiRoutes from './routes/api'; // Import API routes

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
app.get('/', (req, res) => {
  // Render the index.ejs template from the views directory
  res.render('index', {
    // You can pass variables to your template here if needed
    // Example: title: 'Kanji Study Helper'
  });
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`API Docs available at http://localhost:${port}/api-docs`);
}); 