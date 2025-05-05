import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kanji Study API',
      version: '1.0.0',
      description: 'API for generating Kanji study materials using OpenAI',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3001}`,
        description: 'Development server',
      },
    ],
  },
  // Path to the API docs
  // Note: You'll need to specify your routes here
  apis: [path.join(__dirname, './server.ts')], // Pointing to the server file where routes are defined
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec; 