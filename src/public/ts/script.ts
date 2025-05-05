// --- Type Definitions (matching backend response) ---
type CompoundWord = {
    word: string;
    reading: string;
    meaning: string;
};

type ExampleSentence = {
    japanese: string;
    reading: string;
    translation: string;
};

type KanjiApiResponse = {
    kanji: string;
    reading: string;
    meaning: string;
    compound_words: CompoundWord[];
    example_sentences: {
        easy: ExampleSentence;
        medium: ExampleSentence;
        hard: ExampleSentence;
    };
};

// --- DOM Element Selection ---
const kanjiInput = document.getElementById('kanji-input') as HTMLInputElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const loadingIndicator = document.getElementById('loading-indicator') as HTMLDivElement;
const resultsSection = document.getElementById('results-section') as HTMLElement;
const errorMessageDiv = document.getElementById('error-message') as HTMLDivElement;
const errorTextSpan = document.getElementById('error-text') as HTMLSpanElement;

// Result fields
const resultKanji = document.getElementById('result-kanji') as HTMLElement;
const resultReading = document.getElementById('result-reading') as HTMLElement;
const resultMeaning = document.getElementById('result-meaning') as HTMLElement;
const compoundsList = document.getElementById('compounds-list') as HTMLUListElement;
const sentencesList = document.getElementById('sentences-list') as HTMLDivElement;

// --- Initial State Setup ---
hideResults(); // Explicitly hide results on script load
hideError();   // Explicitly hide error on script load

// --- Event Listeners ---
generateButton.addEventListener('click', handleGenerateClick);

// --- Functions ---
async function handleGenerateClick() {
    const kanji = kanjiInput.value.trim();

    // Basic frontend validation (complementary to backend)
    if (!kanji) {
        showError('Please enter Kanji characters.');
        return;
    }
    // Simple regex check - backend has the more robust one
    if (!/^[一-鿿㐀-䶿豈-﫿]+$/.test(kanji)) {
         showError('Input must contain only Kanji characters.');
         return;
     }
    if (kanji.length > 3) {
        showError('Please enter 1 to 3 Kanji characters.');
        return;
    }

    showLoading(true);
    hideError();
    hideResults();

    try {
        // Use a relative URL since frontend and API are served from the same origin
        const backendUrl = '/api/kanji'; // Relative path
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ kanji: kanji }),
        });

        showLoading(false);

        if (!response.ok) {
            // Handle HTTP errors (like 400, 429, 500) from backend
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        const data: KanjiApiResponse = await response.json();
        displayResults(data);

    } catch (error) {
        console.error('Fetch error:', error);
        showLoading(false);
        showError(error instanceof Error ? error.message : 'An unknown error occurred');
    }
}

function displayResults(data: KanjiApiResponse) {
    resultKanji.textContent = data.kanji;
    resultReading.textContent = data.reading;
    resultMeaning.textContent = data.meaning;

    // Populate compound words
    compoundsList.innerHTML = ''; // Clear previous results
    data.compound_words.forEach(cw => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${cw.word} (${cw.reading}):</strong> ${cw.meaning}`;
        compoundsList.appendChild(li);
    });

    // Populate example sentences
    sentencesList.innerHTML = ''; // Clear previous results
    const levels: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
    levels.forEach(level => {
        const sentenceData = data.example_sentences[level];
        const div = document.createElement('div');
        const levelCapitalized = level.charAt(0).toUpperCase() + level.slice(1);
        let levelColor = 'text-green-700';
        if (level === 'medium') levelColor = 'text-yellow-700';
        if (level === 'hard') levelColor = 'text-red-700';

        div.innerHTML = `
            <h4 class="font-semibold text-lg ${levelColor}">${levelCapitalized}</h4>
            <p class="text-xl mt-1 font-medium">${sentenceData.japanese}</p>
            <p class="text-md text-gray-600">${sentenceData.reading}</p>
            <p class="text-sm text-gray-500 italic">${sentenceData.translation}</p>
        `;
        sentencesList.appendChild(div);
    });

    showResults();
}

function showLoading(isLoading: boolean) {
    if (isLoading) {
        loadingIndicator.classList.remove('hidden');
        generateButton.disabled = true;
        generateButton.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        loadingIndicator.classList.add('hidden');
        generateButton.disabled = false;
        generateButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

function showError(message: string) {
    errorTextSpan.textContent = message;
    errorMessageDiv.classList.remove('hidden');
    hideResults(); // Hide results section if error occurs
}

function hideError() {
    errorMessageDiv.classList.add('hidden');
}

function showResults() {
    resultsSection.classList.remove('hidden');
}

function hideResults() {
    resultsSection.classList.add('hidden');
    // Optionally clear previous results fields here if needed
    // resultKanji.textContent = '...';
    // ... etc ...
}

console.log("Kanji Study App script loaded.");

// Add an empty export to treat this file as a module, resolving top-level await issue
export {}; 