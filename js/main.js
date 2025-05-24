// Comment out most imports for now to simplify
// import * as utils from './utils.js';
// import { initDB, executeQuery } from './dbService.js';
// import { loadHtmlViews } from './viewLoader.js';
// import * as wordServiceFunctions from './wordService.js';
// import { TARGET_LANGUAGE_CODE as CONFIG_TARGET_LANGUAGE_CODE } from './config.js';

console.log('[main.js] Script start - SIMPLIFIED VERSION (Clean)');

document.addEventListener('alpine:init', () => {
    console.log('[main.js] alpine:init event listener in main.js fired - SIMPLIFIED VERSION (Clean)');
    Alpine.data('appState', () => {
        console.log('[main.js] Alpine.data("appState") factory function executed - SIMPLIFIED VERSION (Clean)');
        return {
            isLoadingWords: true,
            currentViewLoaded: false,
            allWordsFlat: [{ term: "Test Word Nav 1" }, { term: "Test Word Nav 2" }],
            message: 'Alpine is working with a clean simplified appState!',

            initAppSimplified() {
                console.log('[appState] initAppSimplified() called');
                this.isLoadingWords = false;
                this.currentViewLoaded = true;
                this.message = "Clean Simplified App Initialized!";
                this.populateWordNavigationSimplified();

                const viewContainer = document.getElementById('view-container');
                if (viewContainer && viewContainer.innerHTML.trim() === '') {
                    viewContainer.innerHTML = `<p class="text-center p-5">${this.message}</p>`;
                }
            },
            initiatePractice(words) {
                console.log('[appState] initiatePractice called with (simplified):', words);
                const wordTerm = (words && words.length > 0) ? words[0].term : 'no words';
                alert('Clean Simplified Practice initiated with: ' + wordTerm);
                const viewContainer = document.getElementById('view-container');
                if (viewContainer) {
                    viewContainer.innerHTML = `<p class="text-center p-5">Clean simplified practice view for ${words ? words.length : 0} words. First word: ${wordTerm}</p>`;
                }
            },
            populateWordNavigationSimplified() {
                console.log('[appState] populateWordNavigationSimplified called');
                const navList = document.getElementById('word-navigation-list');
                if (navList) {
                    navList.innerHTML = ''; // Clear previous
                    if (this.allWordsFlat && this.allWordsFlat.length > 0) {
                        this.allWordsFlat.forEach(word => {
                            const li = document.createElement('li');
                            li.textContent = word.term;
                            li.className = 'p-2 hover:bg-gray-200 cursor-pointer text-gray-700';
                            navList.appendChild(li);
                        });
                    } else {
                        navList.innerHTML = '<li class="text-gray-500">No test words in clean simplified state.</li>';
                    }
                } else {
                    console.warn("word-navigation-list not found for clean simplified population");
                }
            },
            init() {
                console.log('[appState] Alpine component init() called - SIMPLIFIED (Clean)');
                this.initAppSimplified();
            }
        };
    });
    console.log('[main.js] Alpine.data registration complete for appState - SIMPLIFIED VERSION (Clean)');
});

console.log('[main.js] Script end, Alpine:init listener attached - SIMPLIFIED VERSION (Clean)'); 