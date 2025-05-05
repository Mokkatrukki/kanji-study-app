import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kanji Study Helper API',
      version: '1.0.0',
      description: 'API documentation for the Kanji Study Helper application',
    },
    servers: [
      {
        url: 'http://localhost:3001', // Adjust if your server runs elsewhere
        description: 'Development server',
      },
      // You can add more servers here (e.g., production)
    ],
    tags: [ // Define tags used in routes
        {
            name: 'Kanji',
            description: 'Operations related to Kanji information'
        }
    ]
  },
  // Path to the API docs files (now in src/routes)
  apis: ['./src/routes/**/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec; 