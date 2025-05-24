// Note: `this` in these functions will refer to the Alpine component instance

export function loadModules() {
    if (!this.db) {
        this.error = "Database not available to load modules.";
        console.error(this.error);
        return;
    }
    const query = "SELECT id, name, description FROM modules ORDER BY name;";
    const results = this.executeQuery(query);
    if (results) {
        this.modules = results;
        console.log("Modules loaded:", this.modules);
    } else {
        console.error("Failed to load modules.");
    }
}

export function selectModule(moduleId) {
    console.log(`Module selected: ${moduleId}`);
    this.selectedModuleId = moduleId;
    this.selectedWordId = null;
    this.wordsInSelectedModule = [];
    this.clearWordDetails(); // Assumes clearWordDetails is a method on `this`

    this.viewedWordsInModule.clear();
    this.midModulePracticeCompleted = false;
    this.endModulePracticeCompleted = false;
    this.isPracticeActive = false;

    if (moduleId) {
        this.loadWordsForModule(moduleId); // Assumes loadWordsForModule is a method on `this`
    }
}

export function loadWordsForModule(moduleId) {
    if (!this.db) {
        this.error = "Database not available to load words.";
        console.error(this.error);
        return;
    }
    const query = `
        SELECT w.id, w.term
        FROM words w
        JOIN word_module_assignments wma ON w.id = wma.word_id
        WHERE wma.module_id = ?
        ORDER BY w.term;
    `;
    const results = this.executeQuery(query, [moduleId]);
    if (results) {
        this.wordsInSelectedModule = results;
        console.log(`Words for module ${moduleId}:`, this.wordsInSelectedModule);
        if (this.wordsInSelectedModule.length === 0) {
            console.warn(`No words found for module ${moduleId}.`);
        }
    } else {
        console.error(`Failed to load words for module ${moduleId}.`);
    }
} 