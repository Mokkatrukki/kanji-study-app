# Kanji Study Helper

A web application that helps users study Japanese Kanji by generating relevant information using the OpenAI API. Users can input one or more Kanji characters, and the app provides readings, meanings, compound words, and example sentences at different difficulty levels.

## Goal

The primary goal is to provide a simple interface for users to quickly generate study materials for specific Kanji characters leveraging the power of AI.

## Features

*   Input 1-3 Kanji characters.
*   Fetches structured data from the OpenAI API (via a secure backend).
*   Displays:
    *   Kanji character(s)
    *   Romaji reading(s)
    *   English meaning(s)
    *   A list of relevant compound words (with readings and meanings).
    *   Example sentences using the base Kanji (Easy, Medium, Hard levels) with readings and translations.
*   Input validation on both frontend and backend (character type, length).
*   API endpoint (`/api/kanji`) is rate-limited to prevent abuse.
*   Basic loading indicator during API calls.
*   Swagger API documentation available at `/api-docs`.

## Tech Stack

*   **Backend:** Node.js, Express.js, TypeScript
*   **Frontend:** EJS (Server-Side Templates), Vanilla TypeScript, Tailwind CSS
*   **AI Service:** OpenAI API (gpt-3.5-turbo or newer)
*   **Containerization:** Docker

## Project Structure

The project has been refactored into a single, consolidated application where the Express server handles both API requests and serves the frontend UI.

```
.
├── Dockerfile              # For building the production Docker image
├── package.json            # Project dependencies and scripts
├── package-lock.json
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.client.json    # TypeScript config for client-side code
├── tsconfig.server.json    # TypeScript config for server-side code
├── .env                    # Environment variables (contains API key - *not committed*)
├── .gitignore
├── src/                    # Source code directory
│   ├── public/             # Static assets served directly
│   │   ├── ts/             # Client-side TypeScript source (script.ts)
│   │   └── styles/         # Input CSS for Tailwind (input.css)
│   ├── routes/             # API route definitions
│   │   └── api.ts          # Handles /api/* routes (e.g., /api/kanji)
│   ├── views/              # EJS template files
│   │   └── index.ejs       # Main HTML structure
│   ├── server.ts           # Express application setup and entry point
│   └── swagger.ts          # Swagger API documentation configuration
└── dist/                   # Compiled output (JS, CSS, Views) - *generated, not committed*
```

## Environment Variables

The application requires an OpenAI API key to function. Create a `.env` file in the project root with the following content:

```plaintext
OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE
```

Replace `YOUR_OPENAI_API_KEY_HERE` with your actual key. This file is listed in `.gitignore` and should not be committed to version control.

## Getting Started (Local Development)

1.  **Clone the repository** (if applicable).
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Create the `.env` file** in the project root and add your `OPENAI_API_KEY` (see above).
4.  **Run the development server:**
    ```bash
    npm run dev
    ```
    This command compiles assets, starts the server with `nodemon`, and watches for changes in TS, EJS, and CSS files, automatically rebuilding and restarting as needed.
5.  **Access the application:** Open your browser and navigate to `http://localhost:3001`.

## Available Scripts

*   `npm run dev`: Starts the development server with watchers.
*   `npm run build`: Compiles all assets (Server TS, Client TS, CSS, Views) into the `dist` directory for production.
*   `npm start`: Runs the production-ready application from the `dist` directory (requires running `npm run build` first).
*   `npm test`: (Currently not implemented)

## Running with Docker (Local)

1.  Ensure Docker Desktop is running.
2.  Make sure your `.env` file exists in the project root.
3.  **Build the image:**
    ```bash
    docker build -t kanji-study-app:latest .
    ```
4.  **Run the container:**
    ```bash
    docker run --rm -p 3001:3001 --env-file .env -d --name kanji-app-container kanji-study-app:latest
    ```
5.  **Access the application:** `http://localhost:3001`

## Deployment (Fly.io)

This application is configured for easy deployment to Fly.io using the included `Dockerfile`.

1.  Install `flyctl`.
2.  Log in: `fly auth login`.
3.  Set the OpenAI API key as a secret:
    ```bash
    fly secrets set OPENAI_API_KEY="YOUR_ACTUAL_OPENAI_KEY"
    ```
4.  Launch the app: `fly launch` (follow prompts, it should detect the `Dockerfile`).
5.  Deploy (if needed): `fly deploy`.

# Kanji Study Helper - API Backend

This backend service provides an API endpoint to fetch detailed information about Japanese Kanji characters. It uses a hybrid approach, primarily fetching data from Jisho.org via the `unofficial-jisho-api` for speed and falling back to OpenAI for more comprehensive data or specific needs like example sentences.

## Core Functionality

The main endpoint `/api/kanji` (POST request) accepts a Kanji character and returns a JSON object with its details.

## Integration with `unofficial-jisho-api`

To provide fast and accurate dictionary-like information, the backend integrates the `unofficial-jisho-api` npm package.

### Primary Data Fetching

When a request for a Kanji is received, the API first attempts to fetch data using the `unofficial-jisho-api`.

*   **Function Called:** `jisho.searchForKanji(kanjiCharacter)`
    *   This function from the `unofficial-jisho-api` is used to get core details about the specified Kanji.

*   **Data Extracted from `searchForKanji`:**
    *   **Kanji Character:** The queried Kanji itself (from `result.query`).
    *   **Primary Reading:** The first Kun'yomi reading if available, otherwise the first On'yomi reading (from `result.kunyomi[0]` or `result.onyomi[0]`)
        *   *Note: These readings are in Kana (e.g., ひ, び, ほ).*
    *   **Meaning:** The English meaning of the Kanji (from `result.meaning`).
    *   **Compound Words:** A list of up to 5 compound words containing the Kanji. These are derived by processing `result.kunyomiExamples` and `result.onyomiExamples`.
        *   Each compound word includes:
            *   `word`: The compound word in Japanese (e.g., "日本語").
            *   `reading`: The Kana reading of the compound word (e.g., "にほんご").
            *   `meaning`: The English meaning of the compound word.
        *   *Note: The readings for compound words are also in Kana.*

### Example Sentences (via OpenAI)

While `unofficial-jisho-api` has methods for example sentences, this backend currently uses OpenAI to generate example sentences (`easy`, `medium`, `hard`) that specifically use the base input Kanji (not compounds) and provide Romaji readings. This is done via a separate, parallel API call to OpenAI (`fetchExampleSentencesFromOpenAI`).

### Fallback Mechanism

If the `jisho.searchForKanji()` call fails to find the Kanji or encounters an error, the system falls back to a more comprehensive data fetch from the OpenAI API (`fetchKanjiDataFromOpenAI_Full`), which provides all required fields including Romaji readings and example sentences as per a detailed prompt.

## Caching

All successfully fetched data (whether from Jisho, OpenAI, or a combination) is cached to improve response times for subsequent requests for the same Kanji. 