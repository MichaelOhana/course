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
                // Load all words for the navigation panel
                const allWordsQuery = 'SELECT * FROM words ORDER BY module_id, id';
                this.allWordsFlat = this.executeQuery(allWordsQuery) ?? [];

                // If modules weren't loaded properly, try to extract them from words
                if ((!this.modules || this.modules.length === 0) && this.allWordsFlat.length > 0) {
                    console.log('[appState] Extracting modules from words data...');
                    const moduleMap = new Map();
                    this.allWordsFlat.forEach(word => {
                        if (word.module_id && !moduleMap.has(word.module_id)) {
                            moduleMap.set(word.module_id, {
                                id: word.module_id,
                                name: word.module_name || `Module ${word.module_id}`,
                                description: `Module containing ${word.module_id} words`
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

            // Create navigation items
            Object.keys(wordsByModule).forEach(moduleId => {
                const module = this.modules.find(m => m.id == moduleId);
                const moduleName = module ? module.name : `Module ${moduleId}`;

                // Create module header
                const moduleHeader = document.createElement('li');
                moduleHeader.className = 'font-semibold text-purple-600 mt-4 mb-2 border-b border-purple-200 pb-1';
                moduleHeader.textContent = moduleName;
                navList.appendChild(moduleHeader);

                // Create word items for this module
                wordsByModule[moduleId].forEach(word => {
                    const wordItem = document.createElement('li');
                    wordItem.className = 'cursor-pointer p-2 rounded hover:bg-purple-100 transition-colors text-sm';
                    wordItem.textContent = word.term || 'Unknown word';
                    wordItem.addEventListener('click', () => this.selectWordFromNav(word.id));
                    navList.appendChild(wordItem);
                });
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
                // Check if modules are available
                const moduleCards = this.modules && this.modules.length > 0
                    ? this.modules.map(module => `
                        <div class="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer" 
                             onclick="window.appStateInstance && window.appStateInstance.selectModule(${module.id})">
                            <h3 class="text-xl font-semibold text-purple-700 mb-2">${module.name || 'Unnamed Module'}</h3>
                            <p class="text-gray-600">${module.description || 'Click to explore this module'}</p>
                        </div>
                    `).join('')
                    : '<p class="text-gray-500 col-span-full text-center">No modules available or still loading...</p>';

                viewContainer.innerHTML = `
                    <div class="text-center py-20">
                        <h1 class="text-3xl font-bold text-purple-700 mb-4">Language Learning Course</h1>
                        <p class="text-lg text-gray-600 mb-6">Select a word from the navigation panel to begin learning.</p>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
                            ${moduleCards}
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
                    this.selectedWordDetails = wordResults[0];

                    // Load examples
                    const examplesQuery = 'SELECT * FROM examples WHERE word_id = ?';
                    this.selectedWordExamples = this.executeQuery(examplesQuery, [wordId]) || [];

                    // Load conversations
                    const conversationsQuery = 'SELECT * FROM conversations WHERE word_id = ?';
                    this.selectedWordConversations = this.executeQuery(conversationsQuery, [wordId]) || [];

                    // Load clips
                    const clipsQuery = 'SELECT * FROM clips WHERE word_id = ?';
                    this.selectedWordClips = this.executeQuery(clipsQuery, [wordId]) || [];

                    console.log('[appState] Word details loaded for:', wordId);
                } else {
                    this.error = `Word with ID ${wordId} not found.`;
                }
            } catch (err) {
                console.error('[appState] loadWordDetailsById() error:', err);
                this.error = 'Failed to load word details';
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
