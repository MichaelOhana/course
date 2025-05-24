import { VIEWS } from './config.js';

// This function will be a method of the Alpine 'appState'
// `this` will refer to the appState instance.
export async function loadHtmlViews() {
    this.isLoadingHtmlViews = true;
    console.log("[viewLoader.js] Loading HTML views...");
    try {
        const [
            // menuRes, // Uncomment if/when menu.html is used
            wordRes,
            practiceRes
        ] = await Promise.all([
            // fetch(VIEWS.MENU),
            fetch(VIEWS.WORD_DETAIL),
            fetch(VIEWS.PRACTICE)
        ]);

        // if (!menuRes.ok) throw new Error(`Failed to fetch ${VIEWS.MENU}: ${menuRes.statusText}`);
        // this.menuViewHtml = await menuRes.text();

        if (!wordRes.ok) throw new Error(`Failed to fetch ${VIEWS.WORD_DETAIL}: ${wordRes.statusText}`);
        this.wordDetailViewHtml = await wordRes.text();

        if (!practiceRes.ok) throw new Error(`Failed to fetch ${VIEWS.PRACTICE}: ${practiceRes.statusText}`);
        this.practiceViewHtml = await practiceRes.text();

        console.log("[viewLoader.js] HTML views loaded successfully.");
    } catch (err) {
        console.error("[viewLoader.js] Error loading HTML views:", err);
        this.error = (this.error ? this.error + '; ' : '') + `Failed to load page templates: ${err.message}`;
        // Set error messages for individual views if they fail
        if (!this.wordDetailViewHtml) this.wordDetailViewHtml = `<p class="text-red-500 text-center">Error loading word detail view. Please refresh.</p>`;
        if (!this.practiceViewHtml) this.practiceViewHtml = `<p class="text-red-500 text-center">Error loading practice view. Please refresh.</p>`;
        // if (!this.menuViewHtml) this.menuViewHtml = `<p class="text-red-500 text-center">Error loading menu view. Please refresh.</p>`;
    } finally {
        this.isLoadingHtmlViews = false;
    }
} 