# Kanji Study Helper
Version: 1.0.0

A web application that helps users study Japanese Kanji by generating relevant information from various public APIs. Users can input a single Kanji character, and the app provides readings, meanings, compound words, and example sentences.

## Goal

The primary goal is to provide a simple interface for users to quickly generate study materials for specific Kanji characters by leveraging free and open APIs.

## Features

*   Input 1 Kanji character.
*   Fetches structured data via a secure backend from:
    *   `kanjiapi.dev` for Kanji details (readings, meanings) and compound words.
    *   `Tatoeba.org` for example sentences.
*   Displays:
    *   Kanji character(s)
    *   Primary Kana reading(s)
    *   English meaning(s)
    *   A list of relevant compound words (with Kana readings and English meanings), filtered for relevance and length.
    *   Up to 5 example sentences (Japanese, Kana reading if available, and English translation).
*   Input validation on both frontend and backend (character type, length).
*   API endpoint (`/api/kanji`) for fetching Kanji data.
*   Basic loading indicator during API calls.
*   Swagger API documentation available at `/api-docs`.

## Tech Stack

*   **Backend:** Node.js, Express.js, TypeScript
*   **Frontend:** EJS (Server-Side Templates), Vanilla TypeScript, Tailwind CSS
*   **Data Sources:**
    *   `kanjiapi.dev` (for Kanji information and words)
    *   `Tatoeba.org` API (for example sentences)
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
├── .env                    # For any other environment variables (e.g., PORT) - *kanjiapi.dev and Tatoeba are public APIs and don't require keys for this app's usage.*
├── .gitignore
├── src/                    # Source code directory
│   ├── public/             # Static assets served directly
│   │   ├── images/         # Public images
│   │   └── ts/             # Client-side TypeScript source
│   │       ├── data/       # Client-side data files (e.g., kanji lists)
│   │       └── script.ts
│   ├── routes/             # API route definitions
│   │   └── api.ts          # Handles /api/* routes (e.g., /api/kanji)
│   ├── styles/             # Input CSS for Tailwind (input.css)
│   │   └── input.css
│   ├── views/              # EJS template files
│   │   └── index.ejs       # Main HTML structure
│   ├── server.ts           # Express application setup and entry point
│   └── swagger.ts          # Swagger API documentation configuration
└── dist/                   # Compiled output (JS, CSS, Views) - *generated, not committed*
```

## Environment Variables

This application's core Kanji lookup functionality uses public APIs (`kanjiapi.dev`, `Tatoeba.org`) that do not require API keys.

If you have other parts of your application or deployment setups (like Fly.io secrets for other services not related to Kanji lookup) that require environment variables, you might still use a `.env` file for local configuration. For example, to set a custom port:
```plaintext
PORT=3001
# OTHER_CUSTOM_VARIABLE=YOUR_VALUE_HERE
```
However, for basic local running, a `.env` file might not be strictly necessary if the default port (3001) is suitable.

## Getting Started (Local Development)

1.  **Clone the repository** (if applicable).
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **(Optional) Create a `.env` file** in the project root if you need to set specific variables like `PORT` (e.g., `PORT=3002`). If not created, the application will use the default port (3001).
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
2.  **(Optional) If you have a `.env` file** for custom configurations (like a different `PORT`), ensure it exists in the project root.
3.  **Build the image:**
    ```bash
    docker build -t kanji-study-app:latest .
    ```
4.  **Run the container:**
    To run with default settings:
    ```bash
    docker run --rm -p 3001:3001 -d --name kanji-app-container kanji-study-app:latest
    ```
    If you are using a `.env` file for custom variables (e.g., `PORT`):
    ```bash
    docker run --rm -p YOUR_CHOSEN_PORT:YOUR_CHOSEN_PORT --env-file .env -d --name kanji-app-container kanji-study-app:latest
    ```
    (Replace `YOUR_CHOSEN_PORT` with the port number you've set if it's different from 3001).
5.  **Access the application:** `http://localhost:3001` (or your custom port).

## Deployment (Fly.io)

This application is configured for easy deployment to Fly.io using the included `Dockerfile`.

1.  Install `flyctl`.
2.  Log in: `fly auth login`.
3.  If you have secrets to set for services not directly used by this Kanji API (e.g., for other parts of a larger app or specific deployment needs), you can set them:
    ```bash
    fly secrets set YOUR_SECRET_NAME="ITS_VALUE"
    ```
4.  Launch the app: `fly launch` (follow prompts, it should detect the `Dockerfile`).
5.  Deploy (if needed): `fly deploy`.

# Kanji Study Helper - API Backend

This backend service provides an API endpoint (`/api/kanji`) to fetch detailed information about Japanese Kanji characters. It now primarily uses `kanjiapi.dev` for core Kanji information and compound words, and `Tatoeba.org` for example sentences.

## Core Functionality

The main endpoint `/api/kanji` (POST request) accepts a single Kanji character and returns a JSON object with its details.

## Data Fetching Strategy

### 1. Kanji Details (via `kanjiapi.dev`)

When a request for a Kanji is received, the API first fetches core details for the input Kanji:

*   **API Called:** `https://kanjiapi.dev/v1/kanji/{character}`
*   **Data Extracted:**
    *   **Kanji Character:** The queried Kanji itself (from `response.kanji`).
    *   **Primary Reading (Kana):** The first Kun'yomi reading if available, otherwise the first On'yomi reading (from `response.kun_readings` or `response.on_readings`).
    *   **Meaning:** The first English meaning provided (from `response.meanings[0]`).

### 2. Compound Words (via `kanjiapi.dev`)

Next, it fetches associated words for the Kanji:

*   **API Called:** `https://kanjiapi.dev/v1/words/{character}`
*   **Data Processing & Filtering:**
    *   The API returns a list of dictionary entries. Each entry can have multiple `variants` (written forms/readings) and `meanings` (with glosses).
    *   The backend processes these to extract compound words:
        *   `word`: The written form of the variant (e.g., "自動車").
        *   `reading`: The pronounced form in Kana (e.g., "じどうしゃ").
        *   `meaning`: The first English gloss for the word.
    *   **Filtering for Relevance:** To provide a concise and relevant list (up to 5 compounds), several filters are applied:
        1.  The compound must include the original input Kanji in its written form.
        2.  The compound must not be identical to the input Kanji character itself.
        3.  The written form of the compound is limited to a maximum of 4 characters to favor shorter, common words.
        4.  The compound must have at least one "priority" tag associated with its variant (indicating some level of commonness or dictionary importance).
        5.  The compound's primary meaning should not be identical (case-insensitive) to the primary meaning of the input Kanji.
    *   **Priority System:** Words with preferred priority tags (e.g., `news1`, `news2`, `nf01-nf15` indicating high frequency) are collected first. If fewer than 5 are found, the list is supplemented by other words that have any priority tag, until up to 5 compounds are selected.

### 3. Example Sentences (via Tatoeba.org)

Finally, example sentences are fetched:

*   **API Called:** `https://api.tatoeba.org/unstable/sentences`
*   **Parameters Used:**
    *   `lang=jpn` (source language is Japanese)
    *   `q={kanji}` (query for the input Kanji)
    *   `trans:lang=eng` (must have an English translation)
    *   `trans:is_direct=yes` (prefer direct translations)
    *   `limit=5` (fetch up to 5 sentences)
    *   `sort=random` (sort results randomly)
    *   `word_count=5-14` (filters sentences to be between 5 and 14 words long)
*   **Data Extracted (for each of up to 5 sentences):**
    *   `japanese`: The Japanese sentence text.
    *   `reading`: A Kana reading of the sentence, if available from transcriptions (this is a simplified extraction).
    *   `translation`: The first direct English translation found (falls back to any English translation if no direct one is present).
