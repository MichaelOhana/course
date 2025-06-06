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

        // ---- mobile menu functions ----
        toggleMobileMenu() {
            console.log('[appState] toggleMobileMenu() called, current state:', this.isMobileMenuOpen);
            console.log('[appState] toggleMobileMenu() event source check - Alpine component available:', !!this);
            this.isMobileMenuOpen = !this.isMobileMenuOpen;
            console.log('[appState] toggleMobileMenu() new state:', this.isMobileMenuOpen);

            // Add body class to prevent scrolling when menu is open
            if (this.isMobileMenuOpen) {
                document.body.classList.add('overflow-hidden');
                console.log('[appState] Added overflow-hidden to body');
            } else {
                document.body.classList.remove('overflow-hidden');
                console.log('[appState] Removed overflow-hidden from body');
            }
        },

        closeMobileMenu() {
            console.log('[appState] closeMobileMenu() called, current state:', this.isMobileMenuOpen);
            if (this.isMobileMenuOpen) {
                this.isMobileMenuOpen = false;
                document.body.classList.remove('overflow-hidden');
                console.log('[appState] Menu closed, state set to false');
            } else {
                console.log('[appState] Menu was already closed');
            }
        },

        // ---- service functions ----
        ...wordServiceFunctions,
        ...moduleServiceFunctions,
        ...practiceServiceFunctions,

        // ---- lifecycle ----
        async init() {
            console.log('[appState] init()');
            // Make this instance globally available
            window.appStateInstance = this;

            // Set initial menu state based on screen size
            // On desktop (md and larger), menu should start open
            // On mobile, menu should start closed
            const isDesktop = window.innerWidth >= 768; // 768px is the md breakpoint in Tailwind
            this.isMobileMenuOpen = isDesktop;
            document.body.classList.remove('overflow-hidden');
            console.log('[appState] Mobile menu state initialized - Desktop:', isDesktop, 'Menu open:', this.isMobileMenuOpen);

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

                // Check if we have a clips table
                const hasClipsTable = tables.some(t => t.name.toLowerCase() === 'clips');
                console.log('[appState] Has clips table:', hasClipsTable);

                // Check words table structure
                if (tables.some(t => t.name.toLowerCase() === 'words')) {
                    const wordsStructure = this.executeQuery("PRAGMA table_info(words)") || [];
                    console.log('[appState] Words table structure:', wordsStructure);
                }

                // Check clips table structure if it exists
                if (hasClipsTable) {
                    const clipsStructure = this.executeQuery("PRAGMA table_info(clips)") || [];
                    console.log('[appState] Clips table structure:', clipsStructure);

                    // Check how many clips are in the database
                    const clipsCount = this.executeQuery("SELECT COUNT(*) as count FROM clips") || [];
                    console.log('[appState] Total clips in database:', clipsCount[0]?.count || 0);

                    // Show sample clips data if any exist
                    if (clipsCount[0]?.count > 0) {
                        const sampleClips = this.executeQuery("SELECT * FROM clips LIMIT 3") || [];
                        console.log('[appState] Sample clips:', sampleClips);

                        // Show which words have clips
                        const wordsWithClips = this.executeQuery(`
                            SELECT w.id, w.term, COUNT(c.id) as clip_count 
                            FROM words w 
                            LEFT JOIN clips c ON w.id = c.word_id 
                            WHERE c.id IS NOT NULL 
                            GROUP BY w.id, w.term 
                            ORDER BY clip_count DESC 
                            LIMIT 5
                        `) || [];
                        console.log('[appState] Words with clips:', wordsWithClips);
                    }
                }

                return { tables, hasModulesTable, hasClipsTable };
            } catch (err) {
                console.error('[appState] Error checking database schema:', err);
                return { tables: [], hasModulesTable: false, hasClipsTable: false };
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
                                name: word.module_name || `Módulo ${word.module_id}`,
                                description: word.module_description || `Módulo que contiene palabras`
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
                this.error = 'Error al cargar las palabras para la navegación';

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
                words.forEach((word, index) => {
                    const wordItem = document.createElement('div');
                    wordItem.className = 'cursor-pointer p-2 rounded hover:bg-purple-100 transition-colors text-sm border-l-2 border-purple-200 pl-3';
                    wordItem.textContent = word.term || 'Palabra desconocida';
                    wordItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.selectWordFromNav(word.id);
                    });
                    container.appendChild(wordItem);

                    // Add first practice section after the 5th word (index 4)
                    if (index === 4 && words.length > 5) {
                        const practiceFirst5Container = document.createElement('div');
                        practiceFirst5Container.className = 'my-3 p-3 bg-blue-50 rounded-lg border border-blue-200';

                        const practiceFirst5Button = document.createElement('button');
                        practiceFirst5Button.className = 'w-full text-left px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors border border-blue-300 font-medium';
                        practiceFirst5Button.textContent = '📝 Practicar Primeras 5 Palabras';
                        practiceFirst5Button.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const first5WordIds = words.slice(0, 5).map(w => w.id);
                            this.startPracticeSession(first5WordIds, `Práctica: Primeras 5 Palabras - ${moduleName}`);
                        });

                        practiceFirst5Container.appendChild(practiceFirst5Button);
                        container.appendChild(practiceFirst5Container);
                    }
                });

                // Add practice sections at the end of the module
                const endPracticeContainer = document.createElement('div');
                endPracticeContainer.className = 'mt-3 space-y-2 border-t border-gray-200 pt-3';

                const moduleWords = words;
                const wordIds = moduleWords.map(word => word.id);
                const module = this.modules.find(m => m.id == moduleId);
                const moduleName = module ? module.name : `Módulo ${moduleId}`;

                // Second practice section - Practice remaining words (after first 5)
                if (words.length > 5) {
                    const practiceRemainingContainer = document.createElement('div');
                    practiceRemainingContainer.className = 'p-2 bg-gray-50 rounded border border-gray-200';

                    const practiceRemainingButton = document.createElement('button');
                    practiceRemainingButton.className = 'w-full text-left px-2 py-1 text-xs text-orange-600 rounded hover:bg-orange-50 transition-colors border-0 font-normal';
                    const remainingCount = words.length - 5;
                    practiceRemainingButton.textContent = `🎯 Practicar ${remainingCount} Palabras Restantes`;
                    practiceRemainingButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const remainingWordIds = wordIds.slice(5);
                        this.startPracticeSession(remainingWordIds, `Práctica: ${remainingCount} Palabras Restantes - ${moduleName}`);
                    });

                    practiceRemainingContainer.appendChild(practiceRemainingButton);
                    endPracticeContainer.appendChild(practiceRemainingContainer);
                }

                // Third practice section - Practice all words in module
                const practiceAllContainer = document.createElement('div');
                practiceAllContainer.className = 'p-2 bg-gray-50 rounded border border-gray-200';

                const practiceAllButton = document.createElement('button');
                practiceAllButton.className = 'w-full text-left px-2 py-1 text-xs text-green-600 rounded hover:bg-green-50 transition-colors border-0 font-normal';
                practiceAllButton.textContent = `📚 Practicar Todas las ${words.length} Palabras`;
                practiceAllButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.startPracticeSession(wordIds, `Práctica: Todas las Palabras - ${moduleName}`);
                });

                practiceAllContainer.appendChild(practiceAllButton);
                endPracticeContainer.appendChild(practiceAllContainer);

                container.appendChild(endPracticeContainer);

                console.log(`[appState] Loaded ${words.length} words for module ${moduleId}`);
            } catch (err) {
                console.error(`[appState] Error loading words for module ${moduleId}:`, err);
                container.innerHTML = '<div class="text-red-500 text-xs p-2">Error al cargar las palabras</div>';
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
                const moduleName = module ? module.name : `Módulo ${moduleId}`;
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
                wordsByModule[moduleId].forEach((word, index) => {
                    const wordItem = document.createElement('div');
                    wordItem.className = 'cursor-pointer p-2 rounded hover:bg-purple-100 transition-colors text-sm border-l-2 border-purple-200 pl-3';
                    wordItem.textContent = word.term || 'Palabra desconocida';
                    wordItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.selectWordFromNav(word.id);
                    });
                    wordsContainer.appendChild(wordItem);

                    // Add first practice section after the 5th word (index 4)
                    if (index === 4 && wordsByModule[moduleId].length > 5) {
                        const practiceFirst5Container = document.createElement('div');
                        practiceFirst5Container.className = 'my-2 p-2 bg-gray-50 rounded border border-gray-200';

                        const practiceFirst5Button = document.createElement('button');
                        practiceFirst5Button.className = 'w-full text-left px-2 py-1 text-xs text-blue-600 rounded hover:bg-blue-50 transition-colors border-0 font-normal';
                        practiceFirst5Button.textContent = '📝 Practicar Primeras 5 Palabras';
                        practiceFirst5Button.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const first5WordIds = wordsByModule[moduleId].slice(0, 5).map(w => w.id);
                            this.startPracticeSession(first5WordIds, `Práctica: Primeras 5 Palabras - ${moduleName}`);
                        });

                        practiceFirst5Container.appendChild(practiceFirst5Button);
                        wordsContainer.appendChild(practiceFirst5Container);
                    }
                });

                // Add practice sections at the end of the module
                const endPracticeContainer = document.createElement('div');
                endPracticeContainer.className = 'mt-3 space-y-2 border-t border-gray-200 pt-3';

                const moduleWords = wordsByModule[moduleId];
                const wordIds = moduleWords.map(word => word.id);

                // Second practice section - Practice remaining words (after first 5)
                if (moduleWords.length > 5) {
                    const practiceRemainingContainer = document.createElement('div');
                    practiceRemainingContainer.className = 'p-2 bg-gray-50 rounded border border-gray-200';

                    const practiceRemainingButton = document.createElement('button');
                    practiceRemainingButton.className = 'w-full text-left px-2 py-1 text-xs text-orange-600 rounded hover:bg-orange-50 transition-colors border-0 font-normal';
                    const remainingCount = moduleWords.length - 5;
                    practiceRemainingButton.textContent = `🎯 Practicar ${remainingCount} Palabras Restantes`;
                    practiceRemainingButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const remainingWordIds = wordIds.slice(5);
                        this.startPracticeSession(remainingWordIds, `Práctica: ${remainingCount} Palabras Restantes - ${moduleName}`);
                    });

                    practiceRemainingContainer.appendChild(practiceRemainingButton);
                    endPracticeContainer.appendChild(practiceRemainingContainer);
                }

                // Third practice section - Practice all words in module
                const practiceAllContainer = document.createElement('div');
                practiceAllContainer.className = 'p-2 bg-gray-50 rounded border border-gray-200';

                const practiceAllButton = document.createElement('button');
                practiceAllButton.className = 'w-full text-left px-2 py-1 text-xs text-green-600 rounded hover:bg-green-50 transition-colors border-0 font-normal';
                practiceAllButton.textContent = `📚 Practicar Todas las ${moduleWords.length} Palabras`;
                practiceAllButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.startPracticeSession(wordIds, `Práctica: Todas las Palabras - ${moduleName}`);
                });

                practiceAllContainer.appendChild(practiceAllButton);
                endPracticeContainer.appendChild(practiceAllContainer);

                wordsContainer.appendChild(endPracticeContainer);

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
            // Close mobile menu when word is selected
            this.closeMobileMenu();
            await this.showWordDetail(wordId);
        },

        async showMenuView() {
            console.log('[appState] showMenuView()');
            this.currentView = 'menu';
            const viewContainer = document.getElementById('view-container');
            if (viewContainer) {
                viewContainer.innerHTML = `
                    <div class="pt-16 md:pt-0">
                        <div class="text-center py-20">
                            <h1 class="text-3xl font-bold text-purple-700 mb-4">Curso de Aprendizaje de Idiomas</h1>
                            <p class="text-lg text-gray-600 mb-6">Selecciona un módulo del panel de navegación para comenzar a aprender.</p>
                            <div class="bg-white p-8 rounded-lg shadow-md max-w-2xl mx-auto">
                                <h2 class="text-xl font-semibold text-purple-600 mb-4">Cómo Usar Este Curso</h2>
                                <div class="text-left space-y-3 text-gray-700">
                                    <p>• <strong>Explorar Módulos:</strong> Haz clic en cualquier módulo en el panel izquierdo para expandir y ver sus palabras</p>
                                    <p>• <strong>Estudiar Palabras:</strong> Haz clic en palabras individuales para ver información detallada, ejemplos y audio</p>
                                    <p>• <strong>Sesiones de Práctica:</strong> Cada módulo tiene opciones de práctica estratégicamente ubicadas:</p>
                                    <p class="ml-6">📝 <strong>Practicar Primeras 5 Palabras</strong> - Aparece después de la 5ª palabra</p>
                                    <p class="ml-6">🎯 <strong>Practicar Palabras Restantes</strong> - Aparece al final para las palabras 6+</p>
                                    <p class="ml-6">📚 <strong>Practicar Todas las Palabras</strong> - Revisión completa del módulo al final</p>
                                    <p>• <strong>Tipos de Ejercicios:</strong> La práctica incluye completar oraciones y conversaciones</p>
                                </div>
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
                // Wait for DOM to be ready
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            // Load word details
            await this.loadWordDetailsById(wordId);

            // Render YouTube clips using plain JavaScript with retry logic
            if (this.currentWord && this.currentWord.clips) {
                console.log('[appState] Rendering clips with plain JS:', this.currentWord.clips.length);

                // Retry logic to ensure container is available
                let attempts = 0;
                const maxAttempts = 10;

                const tryRenderClips = async () => {
                    attempts++;
                    const container = document.getElementById('youtube-clips-container');

                    if (container) {
                        console.log('[appState] Container found on attempt', attempts, ', rendering clips...');
                        this.renderYouTubeClips(this.currentWord.clips, 'youtube-clips-container');
                        return true;
                    } else if (attempts < maxAttempts) {
                        console.log('[appState] Container not found, attempt', attempts, 'of', maxAttempts, ', retrying in 100ms...');
                        await new Promise(resolve => setTimeout(resolve, 100));
                        return tryRenderClips();
                    } else {
                        console.error('[appState] youtube-clips-container not found after', maxAttempts, 'attempts');
                        // Try to create the container if it doesn't exist
                        const fallbackContainer = document.createElement('div');
                        fallbackContainer.id = 'youtube-clips-container';
                        fallbackContainer.className = 'space-y-4 mt-6';

                        const wordDetailContainer = document.querySelector('.bg-white.p-6.rounded-lg.shadow-md.space-y-6');
                        if (wordDetailContainer) {
                            wordDetailContainer.appendChild(fallbackContainer);
                            console.log('[appState] Created fallback container, rendering clips...');
                            this.renderYouTubeClips(this.currentWord.clips, 'youtube-clips-container');
                            return true;
                        }
                        return false;
                    }
                };

                await tryRenderClips();
            } else {
                console.log('[appState] No clips to render');
            }

            this.isLoadingWordDetails = false;
        },

        async loadWordDetailsById(wordId) {
            if (!this.db || !wordId) {
                this.error = "La base de datos no está disponible o no se proporcionó ID de palabra.";
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
                        const translationResults = this.executeQuery(translationQuery, [wordId, CONFIG_TARGET_LANGUAGE_CODE]);
                        if (translationResults && translationResults.length > 0) {
                            wordTranslation = translationResults[0].translation;
                        }
                        console.log('[appState] Word translation query result:', translationResults, 'for language:', CONFIG_TARGET_LANGUAGE_CODE);
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
                        clips: [],
                        notes: wordData.notes
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
                                const exampleTranslationResults = this.executeQuery(exampleTranslationQuery, [example.id, CONFIG_TARGET_LANGUAGE_CODE]);
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
                        const conversationsQuery = 'SELECT * FROM conversation_lines WHERE word_id = ? ORDER BY id';
                        const conversations = this.executeQuery(conversationsQuery, [wordId]) || [];
                        this.selectedWordConversations = conversations;

                        console.log('[appState] Raw conversation data:', conversations);

                        // Load conversation translations and map to currentWord format
                        if (conversations.length > 0) {
                            const conversationLines = await Promise.all(conversations.map(async (convo) => {
                                let conversationTranslation = null;
                                try {
                                    const convoTranslationQuery = 'SELECT translation FROM conversation_line_translations WHERE conversation_line_id = ? AND language_code = ?';
                                    const convoTranslationResults = this.executeQuery(convoTranslationQuery, [convo.id, CONFIG_TARGET_LANGUAGE_CODE]);
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
                                    audioSrc: convo.audio_data,
                                    lineOrder: convo.line_order,
                                    dbId: convo.id
                                };
                            }));

                            // Group conversations by detecting when line_order resets (indicates new conversation)
                            const conversationGroups = [];
                            let currentGroup = [];
                            let lastLineOrder = -1;

                            conversationLines.forEach((line) => {
                                // If line_order is 0 or goes backwards, start a new conversation group
                                if (line.lineOrder === 0 || line.lineOrder < lastLineOrder) {
                                    if (currentGroup.length > 0) {
                                        conversationGroups.push([...currentGroup]);
                                        currentGroup = [];
                                    }
                                }
                                currentGroup.push(line);
                                lastLineOrder = line.lineOrder;
                            });

                            // Add the last group if it has content
                            if (currentGroup.length > 0) {
                                conversationGroups.push(currentGroup);
                            }

                            // Sort each conversation group by line_order
                            conversationGroups.forEach(group => {
                                group.sort((a, b) => (a.lineOrder || 0) - (b.lineOrder || 0));
                            });

                            console.log('[appState] Grouped conversations:', conversationGroups);

                            // Map to the expected format with separate conversation blocks
                            this.currentWord.conversation = conversationGroups.map(group => ({
                                lines: group
                            }));
                        }
                    } catch (err) {
                        console.warn('[appState] Conversations table not available or error loading conversations:', err);
                        this.selectedWordConversations = [];
                        this.currentWord.conversation = [];
                    }

                    // Load clips
                    try {
                        console.log('[appState] Loading clips for word ID:', wordId);
                        const clipsQuery = 'SELECT * FROM clips WHERE word_id = ?';
                        const clips = this.executeQuery(clipsQuery, [wordId]) || [];
                        console.log('[appState] Clips query result for word', wordId, ':', clips);
                        console.log('[appState] Number of clips found:', clips.length);

                        if (clips.length > 0) {
                            clips.forEach((clip, index) => {
                                console.log(`[appState] Clip ${index + 1}:`, {
                                    id: clip.id,
                                    youtube_url: clip.youtube_url,
                                    start_sec: clip.start_sec
                                });
                            });
                        }

                        this.selectedWordClips = clips;
                        this.currentWord.clips = clips;
                        console.log('[appState] Clips assigned to currentWord:', this.currentWord.clips);
                    } catch (err) {
                        console.warn('[appState] Clips table not available or error loading clips:', err);
                        console.warn('[appState] Error details:', err.message);
                        this.selectedWordClips = [];
                        this.currentWord.clips = [];
                    }

                    console.log('[appState] Word details loaded for:', wordId, this.currentWord);
                } else {
                    this.error = `Palabra con ID ${wordId} no encontrada.`;
                    this.currentWord = null;
                }
            } catch (err) {
                console.error('[appState] loadWordDetailsById() error:', err);
                this.error = 'Error al cargar los detalles de la palabra';
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

        initiatePractice(words) {
            if (!Array.isArray(words) || words.length === 0) return;

            console.log('[appState] initiatePractice()', words.length, 'words');

            // Extract word IDs from the words array
            const wordIds = words.map(word => word.id).filter(id => id);

            if (wordIds.length === 0) {
                console.warn('[appState] No valid word IDs found for practice');
                return;
            }

            // Start practice session with all words
            this.startPracticeSession(wordIds, `Práctica: Todas las ${wordIds.length} Palabras`);
        },

        renderYouTubeClips(clips, containerId) {
            // Use the utility function from utils.js
            utils.renderYouTubeClips(clips, containerId);
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
