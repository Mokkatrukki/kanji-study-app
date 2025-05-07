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

// New type for Tatoeba example sentences
type TatoebaSentence = {
    japanese: string;
    reading: string | null; // Reading can be null
    translation: string;
};

type KanjiApiResponse = {
    kanji: string;
    reading: string;
    meaning: string;
    compound_words: CompoundWord[];
    example_sentences: TatoebaSentence[]; // Changed from string to TatoebaSentence[]
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
    // Select and Hide "Example Sentences" section title
    const sentencesHeader = document.querySelector('#sentences-card h3') as HTMLElement | null;
    if (sentencesHeader) {
        sentencesHeader.classList.add('hidden');
    }

    // Select and Modify "Compound Words" section title
    const compoundsHeader = document.querySelector('#compounds-card h3') as HTMLElement | null;
    if (compoundsHeader) {
        compoundsHeader.textContent = 'Key Vocabulary'; // New text
        compoundsHeader.className = 'text-lg font-medium text-gray-700 mb-3'; // New classes for smaller size
    }

    resultKanji.textContent = data.kanji;
    // Clear existing classes and add new ones for main Kanji
    resultKanji.className = 'text-7xl font-bold text-gray-800 text-center mb-1'; // Larger, bolder, centered

    resultReading.textContent = data.reading;
    // Adjust classes for Kanji reading to better match sentence hierarchy
    resultReading.className = 'text-xl text-gray-600 text-center mb-1'; 

    resultMeaning.textContent = data.meaning;
    // Adjust classes for Kanji meanings to match sentence translation "whispering" style
    resultMeaning.className = 'text-sm text-gray-500 italic text-center mb-4'; 

    // Populate compound words
    compoundsList.innerHTML = ''; // Clear previous results
    if (data.compound_words && data.compound_words.length > 0) {
        data.compound_words.forEach(cw => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${cw.word} (${cw.reading}):</strong> ${cw.meaning}`;
            compoundsList.appendChild(li);
        });
    } else {
        compoundsList.innerHTML = '<li>No compound words found.</li>';
    }

    // Display example sentences
    sentencesList.innerHTML = ''; // Clear previous results
    if (data.example_sentences && data.example_sentences.length > 0) {
        data.example_sentences.forEach(sentence => {
            const div = document.createElement('div');
            // Remove border, increase bottom margin for separation
            div.className = 'mb-6 pt-2 pb-2'; 

            // Increase Japanese sentence text size
            let sentenceHTML = `<p class="text-2xl font-medium text-gray-800">${sentence.japanese}</p>`;
            if (sentence.reading) {
                sentenceHTML += `<p class="text-md text-gray-600">${sentence.reading}</p>`;
            }
            sentenceHTML += `<p class="text-sm text-gray-400 italic mt-1">${sentence.translation}</p>`;
            
            div.innerHTML = sentenceHTML;
            sentencesList.appendChild(div);
        });
    } else {
        const p = document.createElement('p');
        p.textContent = "No example sentences found from Tatoeba.";
        p.className = "text-gray-500 italic";
        sentencesList.appendChild(p);
    }

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