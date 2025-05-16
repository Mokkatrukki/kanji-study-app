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

// Updated type for sentence segments
type SentenceSegment = {
    text: string;
    reading?: string; // Reading is optional, only for Kanji parts
};

// Updated type for Tatoeba example sentences
type TatoebaSentence = {
    japanese: string; // The full original Japanese sentence text
    segments: SentenceSegment[];
    translation: string;
};

type KanjiApiResponse = {
    kanji: string;
    reading: string;
    meaning: string;
    compound_words: CompoundWord[];
    example_sentences: TatoebaSentence[]; // Updated to use the new TatoebaSentence type
};

// --- DOM Element Selection ---
const kanjiInput = document.getElementById('kanji-input') as HTMLInputElement;
const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
const randomKanjiButton = document.getElementById('random-kanji-button') as HTMLButtonElement;
const loadingIndicator = document.getElementById('loading-indicator') as HTMLDivElement;
const resultsSection = document.getElementById('results-section') as HTMLElement;
const errorMessageDiv = document.getElementById('error-message') as HTMLDivElement;
const errorTextElement = document.getElementById('error-text') as HTMLParagraphElement;

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
randomKanjiButton.addEventListener('click', handleRandomKanjiClick);
window.addEventListener('popstate', handlePopState); // Add listener for browser navigation

// --- Functions ---

// --- Import Kanji Lists ---
import { allKanji } from './data/kanjiLists.js';

async function handleRandomKanjiClick() {
    if (allKanji && allKanji.length > 0) {
        const randomIndex = Math.floor(Math.random() * allKanji.length);
        kanjiInput.value = allKanji[randomIndex];
        handleGenerateClick(); // Trigger the search with the new random kanji
    } else {
        showError('No Kanji available for random selection.');
    }
}

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
    if (kanji.length > 1) {
        showError('Please enter 1 Kanji character.');
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

        // Update URL if the current kanji is different from the one in the URL
        const currentSearch = new URLSearchParams(window.location.search).get('kanji');
        if (kanji !== currentSearch) {
            const newUrl = `/?kanji=${encodeURIComponent(kanji)}`;
            window.history.pushState({ kanji }, '', newUrl);
        }

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

    // Style for Furigana <rt> tags for compound words and sentences
    const rtStyle = "font-size: 0.6em; line-height: 1.2;";
    // Specific, smaller style for the main Kanji's Furigana
    const mainKanjiRtStyle = "font-size: 0.35em; line-height: 1;";

    // Display main Kanji with Furigana
    if (data.reading && data.reading !== "N/A") {
        resultKanji.innerHTML = `<ruby>${data.kanji}<rt style="${mainKanjiRtStyle}">${data.reading}</rt></ruby>`;
    } else {
        resultKanji.textContent = data.kanji;
    }
    resultKanji.className = 'text-7xl font-bold text-gray-800 text-center mb-1';

    // Hide the old separate reading element
    resultReading.style.display = 'none';
    // Adjust classes for Kanji meanings to match sentence translation "whispering" style
    resultMeaning.textContent = data.meaning;
    resultMeaning.className = 'text-sm text-gray-500 italic text-center mb-4';

    // Populate compound words
    compoundsList.innerHTML = ''; // Clear previous results
    if (data.compound_words && data.compound_words.length > 0) {
        data.compound_words.forEach(cw => {
            const li = document.createElement('li');
            li.className = "flex items-center py-2";
            
            let compoundWordPart;
            if (cw.reading) {
                compoundWordPart = `<ruby>${cw.word}<rt style="${rtStyle}">${cw.reading}</rt></ruby>`;
            } else {
                compoundWordPart = cw.word;
            }

            // Construct HTML for the two-column layout
            // Left column for Japanese word - removed text-right to test alignment
            const leftColumnHTML = `
                <div class="w-2/5 pr-3">
                    <p class="text-3xl font-medium text-gray-800">${compoundWordPart}</p>
                </div>
            `;

            // Right column for English meaning
            const rightColumnHTML = `
                <div class="w-3/5 pl-3">
                    <p class="text-lg text-gray-400 italic">${cw.meaning}</p>
                </div>
            `;
            
            li.innerHTML = leftColumnHTML + rightColumnHTML;
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
            div.className = 'mb-6 pt-2 pb-2';

            // Construct the sentence HTML from segments
            let sentenceWithFuriganaHTML = '';
            sentence.segments.forEach(segment => {
                if (segment.reading) {
                    sentenceWithFuriganaHTML += `<ruby>${segment.text}<rt style="${rtStyle}">${segment.reading}</rt></ruby>`;
                } else {
                    sentenceWithFuriganaHTML += segment.text;
                }
            });

            // Main sentence display using the assembled HTML
            let sentenceHTML = `<p class="text-3xl font-medium text-gray-800">${sentenceWithFuriganaHTML}</p>`;
            sentenceHTML += `<p class="text-lg text-gray-400 italic mt-1">${sentence.translation}</p>`;
            
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
        loadingIndicator.innerHTML = `
            <div class="text-center py-4">
                <span class="text-2xl font-medium text-gray-800">ローディング</span>
                <p class="text-sm text-gray-400 italic mt-1">
                    loading...
                </p>
            </div>
        `;
        // Ensure #loading-indicator in your HTML is styled to center this, e.g.,
        // by adding classes like "flex justify-center items-center" to it if it's not already.
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
    errorTextElement.textContent = message;
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

// Function to handle popstate event (browser back/forward)
async function handlePopState(event: PopStateEvent) {
    if (event.state && event.state.kanji) {
        kanjiInput.value = event.state.kanji;
        await handleGenerateClick(); // Re-trigger search
    } else {
        // If there's no state, it might be the initial page or a non-app state
        // Check URL directly
        const params = new URLSearchParams(window.location.search);
        const kanjiFromUrl = params.get('kanji');
        if (kanjiFromUrl) {
            kanjiInput.value = kanjiFromUrl;
            await handleGenerateClick();
        } else {
            // If no kanji in URL, clear results and input
            hideResults();
            hideError();
            kanjiInput.value = '';
        }
    }
}

// Function to check URL for Kanji on initial load
async function checkUrlForKanji() {
    const params = new URLSearchParams(window.location.search);
    const kanjiFromUrl = params.get('kanji');
    if (kanjiFromUrl) {
        kanjiInput.value = kanjiFromUrl;
        await handleGenerateClick();
    }
}

console.log("Kanji Study App script loaded.");

// Call checkUrlForKanji on initial load
checkUrlForKanji();

// Add an empty export to treat this file as a module, resolving top-level await issue
export {}; 