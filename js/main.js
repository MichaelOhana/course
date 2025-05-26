// main.js – simplified, single‑start Alpine setup
// ------------------------------------------------
// Import your modules
import * as utils from './utils.js';
import { initDB, executeQuery } from './dbService.js';
import { loadHtmlViews } from './viewLoader.js';
import * as wordServiceFunctions from './wordService.js';
import * as moduleServiceFunctions from './moduleService.js';
import * as practiceServiceFunctions from './practiceService.js';
import { TARGET_LANGUAGE_CODE as CONFIG_TARGET_LANGUAGE_CODE } from './config.js';
import { getInitialState } from './state.js';

console.log('[main.js] Script start');

// Function to create the Alpine component
function createAppStateComponent() {
    const state = getInitialState();

    return {
        // ---- reactive state ----
        ...state,

        // ---- utility functions ----
        ...utils,

        // ---- service functions ----
        ...wordServiceFunctions,
        ...moduleServiceFunctions,
        ...practiceServiceFunctions,

        // ---- lifecycle ----
        async init() {
            console.log('[appState] init()');
            // Make this instance globally available
            window.appStateInstance = this;

            try {
                // 1. open the client‑side DB
                console.log('[appState] Step 1: Initializing database...');
                await initDB.call(this);
                console.log('[appState] Database initialized successfully');

                // 2. load HTML fragments for the various views
                console.log('[appState] Step 2: Loading HTML views...');
                await loadHtmlViews.call(this);
                console.log('[appState] HTML views loaded successfully');

                // 3. fetch the modules list and populate navigation
                console.log('[appState] Step 3: Checking database schema...');
                const schema = this.checkDatabaseSchema();

                console.log('[appState] Step 4: Loading modules...');
                if (schema.hasModulesTable) {
                    this.loadModules(); // Use the moduleService function
                } else {
                    console.log('[appState] No modules table found, will extract from words');
                    this.modules = []; // Initialize empty, will be populated from words
                }
                console.log('[appState] Modules loaded, count:', this.modules ? this.modules.length : 0);

                console.log('[appState] Step 5: Loading words for navigation...');
                await this.loadAllWordsForNavigation();
                console.log('[appState] Words loaded, count:', this.allWordsFlat ? this.allWordsFlat.length : 0);

                // 4. load the default view (menu)
                console.log('[appState] Step 6: Showing menu view...');
                await this.showMenuView();
                console.log('[appState] Menu view displayed');

                // 5. we're ready!
                this.isLoading = false;
                console.log('[appState] Initialization complete!');
            } catch (err) {
                console.error('[appState] initialisation failed:', err);
                this.error = err.message;
                this.isLoading = false;
            }
        },

        // ---- database query helper ----
        executeQuery(query, params = []) {
            return executeQuery.call(this, query, params);
        },

        // ---- database schema helpers ----
        checkDatabaseSchema() {
            try {
                // Check what tables exist in the database
                const tablesQuery = "SELECT name FROM sqlite_master WHERE type='table'";
                const tables = this.executeQuery(tablesQuery) || [];
                console.log('[appState] Available tables:', tables.map(t => t.name));

                // Check if we have a modules table
                const hasModulesTable = tables.some(t => t.name.toLowerCase() === 'modules');
                console.log('[appState] Has modules table:', hasModulesTable);

                // Check words table structure
                if (tables.some(t => t.name.toLowerCase() === 'words')) {
                    const wordsStructure = this.executeQuery("PRAGMA table_info(words)") || [];
                    console.log('[appState] Words table structure:', wordsStructure);
                }

                return { tables, hasModulesTable };
            } catch (err) {
                console.error('[appState] Error checking database schema:', err);
                return { tables: [], hasModulesTable: false };
            }
        },

        // ---- navigation and view management ----
        async loadAllWordsForNavigation() {
            try {
                // Load all words with their module assignments for the navigation panel
                const allWordsQuery = `
                    SELECT w.*, m.id as module_id, m.name as module_name, m.description as module_description
                    FROM words w
                    JOIN word_module_assignments wma ON w.id = wma.word_id
                    JOIN modules m ON wma.module_id = m.id
                    ORDER BY m.name, w.term
                `;
                this.allWordsFlat = this.executeQuery(allWordsQuery) ?? [];

                console.log('[appState] Loaded words with modules:', this.allWordsFlat.length);

                // If we have words but no modules loaded yet, extract them from the word data
                if ((!this.modules || this.modules.length === 0) && this.allWordsFlat.length > 0) {
                    console.log('[appState] Extracting modules from words data...');
                    const moduleMap = new Map();
                    this.allWordsFlat.forEach(word => {
                        if (word.module_id && !moduleMap.has(word.module_id)) {
                            moduleMap.set(word.module_id, {
                                id: word.module_id,
                                name: word.module_name || `Module ${word.module_id}`,
                                description: word.module_description || `Module containing words`
                            });
                        }
                    });
                    this.modules = Array.from(moduleMap.values());
                    console.log('[appState] Extracted modules:', this.modules);
                }

                // Populate the navigation list
                this.populateWordNavigation();
            } catch (err) {
                console.error('[appState] loadAllWordsForNavigation() error:', err);
                this.error = 'Failed to load words for navigation';

                // Fallback: try to show modules without words if modules are loaded
                if (this.modules && this.modules.length > 0) {
                    console.log('[appState] Fallback: showing modules without words');
                    this.populateModulesOnly();
                }
            }
        },

        populateModulesOnly() {
            const navList = document.getElementById('word-navigation-list');
            if (!navList) {
                console.error('[appState] Navigation list element not found');
                return;
            }

            console.log('[appState] Populating navigation with modules only');

            // Clear existing content except loading indicator
            const loadingIndicator = navList.querySelector('[x-show="isLoading"]');
            navList.innerHTML = '';
            if (loadingIndicator) navList.appendChild(loadingIndicator);

            // Create module items
            this.modules.forEach(module => {
                const moduleHeader = document.createElement('li');
                moduleHeader.className = 'font-semibold text-purple-700 mt-4 mb-2 border border-purple-200 rounded-lg p-3 cursor-pointer hover:bg-purple-50 transition-colors';
                moduleHeader.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div>
                            <div class="text-sm font-bold">${module.name}</div>
                            ${module.description ? `<div class="text-xs text-purple-600 font-normal mt-1">${module.description}</div>` : ''}
                        </div>
                        <span class="module-toggle text-purple-500">▼</span>
                    </div>
                `;

                // Create words container (initially hidden)
                const wordsContainer = document.createElement('div');
                wordsContainer.className = 'module-words hidden mt-2 ml-4 space-y-1';
                wordsContainer.setAttribute('data-module-id', module.id);

                // Add click handler to module header for expand/collapse and load words
                moduleHeader.addEventListener('click', async () => {
                    const toggle = moduleHeader.querySelector('.module-toggle');
                    const isExpanded = !wordsContainer.classList.contains('hidden');

                    if (isExpanded) {
                        wordsContainer.classList.add('hidden');
                        toggle.textContent = '▼';
                    } else {
                        // Load words for this module if not already loaded
                        if (wordsContainer.children.length === 0) {
                            await this.loadWordsForModuleNavigation(module.id, wordsContainer);
                        }
                        wordsContainer.classList.remove('hidden');
                        toggle.textContent = '▲';
                        // Also select this module
                        this.selectModule(module.id);
                    }
                });

                navList.appendChild(moduleHeader);
                navList.appendChild(wordsContainer);
            });

            console.log('[appState] Navigation populated with modules only');
        },

        async loadWordsForModuleNavigation(moduleId, container) {
            try {
                const query = `
                    SELECT w.id, w.term
                    FROM words w
                    JOIN word_module_assignments wma ON w.id = wma.word_id
                    WHERE wma.module_id = ?
                    ORDER BY w.term
                `;
                const words = this.executeQuery(query, [moduleId]) || [];

                // Clear container and add words
                container.innerHTML = '';
                words.forEach(word => {
                    const wordItem = document.createElement('div');
                    wordItem.className = 'cursor-pointer p-2 rounded hover:bg-purple-100 transition-colors text-sm border-l-2 border-purple-200 pl-3';
                    wordItem.textContent = word.term || 'Unknown word';
                    wordItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.selectWordFromNav(word.id);
                    });
                    container.appendChild(wordItem);
                });

                console.log(`[appState] Loaded ${words.length} words for module ${moduleId}`);
            } catch (err) {
                console.error(`[appState] Error loading words for module ${moduleId}:`, err);
                container.innerHTML = '<div class="text-red-500 text-xs p-2">Error loading words</div>';
            }
        },

        populateWordNavigation() {
            const navList = document.getElementById('word-navigation-list');
            if (!navList) {
                console.error('[appState] Navigation list element not found');
                return;
            }

            if (!this.allWordsFlat || this.allWordsFlat.length === 0) {
                console.warn('[appState] No words available for navigation');
                return;
            }

            console.log('[appState] Populating navigation with', this.allWordsFlat.length, 'words');

            // Clear existing content except loading indicator
            const loadingIndicator = navList.querySelector('[x-show="isLoading"]');
            navList.innerHTML = '';
            if (loadingIndicator) navList.appendChild(loadingIndicator);

            // Group words by module
            const wordsByModule = {};
            this.allWordsFlat.forEach(word => {
                const moduleId = word.module_id || 'ungrouped';
                if (!wordsByModule[moduleId]) {
                    wordsByModule[moduleId] = [];
                }
                wordsByModule[moduleId].push(word);
            });

            console.log('[appState] Words grouped by module:', wordsByModule);

            // Create navigation items with collapsible modules
            Object.keys(wordsByModule).forEach(moduleId => {
                const module = this.modules.find(m => m.id == moduleId);
                const moduleName = module ? module.name : `Module ${moduleId}`;
                const moduleDescription = module ? module.description : '';

                // Create module header (clickable to expand/collapse)
                const moduleHeader = document.createElement('li');
                moduleHeader.className = 'font-semibold text-purple-700 mt-4 mb-2 border border-purple-200 rounded-lg p-3 cursor-pointer hover:bg-purple-50 transition-colors';
                moduleHeader.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div>
                            <div class="text-sm font-bold">${moduleName}</div>
                            ${moduleDescription ? `<div class="text-xs text-purple-600 font-normal mt-1">${moduleDescription}</div>` : ''}
                        </div>
                        <span class="module-toggle text-purple-500">▼</span>
                    </div>
                `;

                // Create words container (initially hidden)
                const wordsContainer = document.createElement('div');
                wordsContainer.className = 'module-words hidden mt-2 ml-4 space-y-1';
                wordsContainer.setAttribute('data-module-id', moduleId);

                // Add words to container
                wordsByModule[moduleId].forEach(word => {
                    const wordItem = document.createElement('div');
                    wordItem.className = 'cursor-pointer p-2 rounded hover:bg-purple-100 transition-colors text-sm border-l-2 border-purple-200 pl-3';
                    wordItem.textContent = word.term || 'Unknown word';
                    wordItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.selectWordFromNav(word.id);
                    });
                    wordsContainer.appendChild(wordItem);
                });

                // Add click handler to module header for expand/collapse
                moduleHeader.addEventListener('click', () => {
                    const toggle = moduleHeader.querySelector('.module-toggle');
                    const isExpanded = !wordsContainer.classList.contains('hidden');

                    if (isExpanded) {
                        wordsContainer.classList.add('hidden');
                        toggle.textContent = '▼';
                    } else {
                        wordsContainer.classList.remove('hidden');
                        toggle.textContent = '▲';
                        // Also select this module
                        this.selectModule(moduleId);
                    }
                });

                navList.appendChild(moduleHeader);
                navList.appendChild(wordsContainer);
            });

            console.log('[appState] Navigation populated successfully');
        },

        async selectWordFromNav(wordId) {
            console.log('[appState] selectWordFromNav()', wordId);
            this.selectedWordId = wordId;
            await this.showWordDetail(wordId);
        },

        async showMenuView() {
            console.log('[appState] showMenuView()');
            this.currentView = 'menu';
            const viewContainer = document.getElementById('view-container');
            if (viewContainer) {
                viewContainer.innerHTML = `
                    <div class="text-center py-20">
                        <h1 class="text-3xl font-bold text-purple-700 mb-4">Language Learning Course</h1>
                        <p class="text-lg text-gray-600 mb-6">Select a module from the navigation panel to begin learning.</p>
                        <div class="bg-white p-8 rounded-lg shadow-md max-w-2xl mx-auto">
                            <h2 class="text-xl font-semibold text-purple-600 mb-4">How to Use This Course</h2>
                            <div class="text-left space-y-3 text-gray-700">
                                <p>• <strong>Browse Modules:</strong> Click on any module in the left panel to expand and see its words</p>
                                <p>• <strong>Study Words:</strong> Click on individual words to view detailed information, examples, and audio</p>
                                <p>• <strong>Practice:</strong> Use the "Practice All Words" button to test your knowledge</p>
                                <p>• <strong>Track Progress:</strong> Your learning progress is automatically saved as you study</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        },

        async showWordDetail(wordId) {
            console.log('[appState] showWordDetail()', wordId);
            this.currentView = 'word';
            this.selectedWordId = wordId;
            this.isLoadingWordDetails = true;

            const viewContainer = document.getElementById('view-container');
            if (viewContainer && this.wordDetailViewHtml) {
                viewContainer.innerHTML = this.wordDetailViewHtml;
            }

            // Load word details
            await this.loadWordDetailsById(wordId);
            this.isLoadingWordDetails = false;
        },

        async loadWordDetailsById(wordId) {
            if (!this.db || !wordId) {
                this.error = "Database not available or no word ID provided.";
                return;
            }

            try {
                // Load basic word details
                const wordQuery = 'SELECT * FROM words WHERE id = ?';
                const wordResults = this.executeQuery(wordQuery, [wordId]);

                if (wordResults && wordResults.length > 0) {
                    const wordData = wordResults[0];

                    // Load word translation
                    let wordTranslation = null;
                    try {
                        const translationQuery = 'SELECT translation FROM words_translations WHERE words_id = ? AND language_code = ?';
                        const translationResults = this.executeQuery(translationQuery, [wordId, this.targetLanguageCode]);
                        if (translationResults && translationResults.length > 0) {
                            wordTranslation = translationResults[0].translation;
                        }
                    } catch (err) {
                        console.warn('[appState] Word translations table not available or error loading translation:', err);
                    }

                    // Map to currentWord for the view
                    this.currentWord = {
                        id: wordData.id,
                        term: wordData.term,
                        definition: wordData.definition,
                        translation: wordTranslation || wordData.translation, // Use translation table first, fallback to words table
                        pronunciation: wordData.pronunciation,
                        audioSrc: wordData.audio_data,
                        exampleSentences: [],
                        conversation: [],
                        clips: []
                    };

                    // Also keep the old format for backward compatibility
                    this.selectedWordDetails = {
                        ...wordData,
                        translation: wordTranslation || wordData.translation
                    };

                    // Load examples with translations
                    try {
                        const examplesQuery = 'SELECT * FROM examples WHERE word_id = ?';
                        const examples = this.executeQuery(examplesQuery, [wordId]) || [];
                        this.selectedWordExamples = examples;

                        // Load example translations and map to currentWord format
                        this.currentWord.exampleSentences = await Promise.all(examples.map(async (example) => {
                            let exampleTranslation = null;
                            try {
                                const exampleTranslationQuery = 'SELECT translation FROM example_translations WHERE example_id = ? AND language_code = ?';
                                const exampleTranslationResults = this.executeQuery(exampleTranslationQuery, [example.id, this.targetLanguageCode]);
                                if (exampleTranslationResults && exampleTranslationResults.length > 0) {
                                    exampleTranslation = exampleTranslationResults[0].translation;
                                }
                            } catch (err) {
                                console.warn('[appState] Example translations table not available:', err);
                            }

                            return {
                                english: example.text,
                                translation: exampleTranslation,
                                audioSrc: example.audio_data
                            };
                        }));
                    } catch (err) {
                        console.warn('[appState] Examples table not available or error loading examples:', err);
                        this.selectedWordExamples = [];
                        this.currentWord.exampleSentences = [];
                    }

                    // Load conversations with translations (handle missing table gracefully)
                    try {
                        const conversationsQuery = 'SELECT * FROM conversation_lines WHERE word_id = ? ORDER BY line_order';
                        const conversations = this.executeQuery(conversationsQuery, [wordId]) || [];
                        this.selectedWordConversations = conversations;

                        // Load conversation translations and map to currentWord format
                        if (conversations.length > 0) {
                            const conversationLines = await Promise.all(conversations.map(async (convo) => {
                                let conversationTranslation = null;
                                try {
                                    const convoTranslationQuery = 'SELECT translation FROM conversation_line_translations WHERE conversation_line_id = ? AND language_code = ?';
                                    const convoTranslationResults = this.executeQuery(convoTranslationQuery, [convo.id, this.targetLanguageCode]);
                                    if (convoTranslationResults && convoTranslationResults.length > 0) {
                                        conversationTranslation = convoTranslationResults[0].translation;
                                    }
                                } catch (err) {
                                    console.warn('[appState] Conversation translations table not available:', err);
                                }

                                return {
                                    speaker: convo.speaker_label || 'Speaker',
                                    line: convo.text,
                                    translatedLine: conversationTranslation,
                                    audioSrc: convo.audio_data
                                };
                            }));

                            this.currentWord.conversation = [{
                                lines: conversationLines
                            }];
                        }
                    } catch (err) {
                        console.warn('[appState] Conversations table not available or error loading conversations:', err);
                        this.selectedWordConversations = [];
                        this.currentWord.conversation = [];
                    }

                    // Load clips
                    try {
                        const clipsQuery = 'SELECT * FROM clips WHERE word_id = ?';
                        const clips = this.executeQuery(clipsQuery, [wordId]) || [];
                        this.selectedWordClips = clips;
                        this.currentWord.clips = clips;
                    } catch (err) {
                        console.warn('[appState] Clips table not available or error loading clips:', err);
                        this.selectedWordClips = [];
                        this.currentWord.clips = [];
                    }

                    console.log('[appState] Word details loaded for:', wordId);
                } else {
                    this.error = `Word with ID ${wordId} not found.`;
                    this.currentWord = null;
                }
            } catch (err) {
                console.error('[appState] loadWordDetailsById() error:', err);
                this.error = 'Failed to load word details';
                this.currentWord = null;
            }
        },

        clearWordDetails() {
            this.selectedWordDetails = {
                term: null,
                definition: null,
                audio_data: null,
                translation: null
            };
            this.selectedWordExamples = [];
            this.selectedWordConversations = [];
            this.selectedWordClips = [];
            this.currentWord = null;
        },

        goBackToWordList() {
            console.log('[appState] goBackToWordList()');
            this.currentView = 'menu';
            this.selectedWordId = null;
            this.currentWord = null;
            this.showMenuView();
        },

        initiatePractice(words) {
            if (!Array.isArray(words) || words.length === 0) return;

            console.log('[appState] initiatePractice()', words.length, 'words');
            this.currentView = 'practice';

            const viewContainer = document.getElementById('view-container');
            if (viewContainer) {
                viewContainer.innerHTML = `<p class="text-center p-5">Practice mode with ${words.length} words</p>`;
            }
        }
    };
}

// Function to register the component
function registerComponent() {
    if (typeof Alpine !== 'undefined') {
        console.log('[main.js] Registering Alpine component');
        Alpine.data('appState', createAppStateComponent);
        console.log('[main.js] Alpine component registered successfully');
        return true;
    }
    return false;
}

// Try to register immediately if Alpine is available
if (registerComponent()) {
    console.log('[main.js] Component registered immediately');
} else {
    // Register Alpine component when Alpine is ready
    document.addEventListener('alpine:init', () => {
        console.log('[main.js] Alpine init event fired, registering component');
        registerComponent();
    });

    // Fallback: check periodically for Alpine
    let attempts = 0;
    const checkInterval = setInterval(() => {
        attempts++;
        if (registerComponent()) {
            console.log('[main.js] Component registered after', attempts * 100, 'ms');
            clearInterval(checkInterval);
        } else if (attempts > 50) { // 5 seconds
            console.error('[main.js] Failed to register component after 5 seconds');
            clearInterval(checkInterval);
        }
    }, 100);
}

console.log('[main.js] Script end');
