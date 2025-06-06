import { PRACTICE_TRIGGER_COUNT } from './config.js';
// shuffleArray and formatSentenceWithBlank are now in utils.js, will be available on `this` via main.js

// Note: `this` in these functions will refer to the Alpine component instance

export function trackViewedWord(wordId) {
    if (!this.selectedModuleId || !wordId) return;

    this.viewedWordsInModule.add(wordId);
    console.log(`Viewed words in module ${this.selectedModuleId}:`, Array.from(this.viewedWordsInModule));

    const totalWordsInModule = this.wordsInSelectedModule.length;
    if (totalWordsInModule === 0) return;

    // Mid-module practice trigger
    if (this.viewedWordsInModule.size >= PRACTICE_TRIGGER_COUNT &&
        !this.midModulePracticeCompleted &&
        totalWordsInModule > PRACTICE_TRIGGER_COUNT) { // Only trigger if module is larger than count
        console.log("Triggering mid-module practice.");
        this.midModulePracticeCompleted = true;
        const wordsForPractice = Array.from(this.viewedWordsInModule).slice(0, PRACTICE_TRIGGER_COUNT);
        this.startPracticeSession(wordsForPractice, `Práctica: Primeras ${PRACTICE_TRIGGER_COUNT} Palabras`);
    }
    // End-of-module practice trigger
    else if (this.viewedWordsInModule.size === totalWordsInModule && !this.endModulePracticeCompleted) {
        console.log("Triggering end-of-module practice.");
        this.endModulePracticeCompleted = true;
        this.startPracticeSession(Array.from(this.viewedWordsInModule), "Práctica: Todas las Palabras del Módulo");
    }
}

export async function startPracticeSession(wordIdsForPractice, title) {
    if (!wordIdsForPractice || wordIdsForPractice.length === 0) {
        console.warn("No words provided for practice session.");
        this.currentView = 'menu'; // Go back to menu if no words
        return;
    }

    // Close mobile menu when practice starts
    this.closeMobileMenu();

    this.isPracticeActive = true;
    this.isLoadingPractice = true;
    this.currentView = 'practice';
    this.practiceSessionTitle = title;
    this.practiceExercises = [];
    this.currentExerciseIndex = -1;
    this.currentExercise = null;
    this.userAnswer = null;
    this.feedbackMessage = { type: '', text: '' };
    this.practiceCompletionMessage = '';

    // Load the practice view HTML template
    const viewContainer = document.getElementById('view-container');
    if (viewContainer && this.practiceViewHtml) {
        viewContainer.innerHTML = this.practiceViewHtml;
        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 150));
    }

    console.log("Starting practice session for word IDs:", wordIdsForPractice);

    const blankExercisesQuery = `
        SELECT feb.id, feb.word_id, feb.sentence AS questionText, feb.distractor_words_json, w.term AS correctAnswerTerm
        FROM fill_in_blank_exercises feb
        JOIN words w ON feb.word_id = w.id
        WHERE feb.word_id IN (${wordIdsForPractice.map(() => '?').join(',')});
    `;
    const convoExercisesQuery = `
        SELECT fce.id, fce.word_id, fce.conversation_json AS questionTextJson, fce.distractor_words_json, w.term AS correctAnswerTerm
        FROM fill_in_conversation_exercises fce
        JOIN words w ON fce.word_id = w.id
        WHERE fce.word_id IN (${wordIdsForPractice.map(() => '?').join(',')});
    `;

    const blankExercises = this.executeQuery(blankExercisesQuery, wordIdsForPractice) || [];
    const convoExercises = this.executeQuery(convoExercisesQuery, wordIdsForPractice) || [];

    blankExercises.forEach(ex => {
        let distractors = [];
        try {
            distractors = JSON.parse(ex.distractor_words_json || '[]');
        } catch (e) { console.error("Error parsing distractor_words_json for blank ex:", e, ex.distractor_words_json); }
        this.practiceExercises.push({
            ...ex,
            type: 'fill-blank',
            options: this.shuffleArray([ex.correctAnswerTerm, ...distractors])
        });
    });

    convoExercises.forEach(ex => {
        let distractors = [];
        let conversationLines = [];
        try {
            distractors = JSON.parse(ex.distractor_words_json || '[]');
        } catch (e) { console.error("Error parsing distractor_words_json for convo ex:", e, ex.distractor_words_json); }
        try {
            conversationLines = JSON.parse(ex.questionTextJson || '[]');
            // Normalize the conversation format - handle both "text" and "line" fields
            conversationLines = conversationLines.map(line => ({
                speaker: line.speaker || 'Speaker',
                line: line.line || line.text || 'Missing text'
            }));
        } catch (e) {
            console.error("Error parsing conversation_json:", e, ex.questionTextJson);
            conversationLines = [{ speaker: "Error", line: "No se pudo cargar la conversación." }];
        }
        this.practiceExercises.push({
            ...ex,
            questionText: conversationLines,
            type: 'fill-conversation',
            options: this.shuffleArray([ex.correctAnswerTerm, ...distractors])
        });
    });

    this.shuffleArray(this.practiceExercises);
    console.log("Prepared practice exercises:", this.practiceExercises);

    if (this.practiceExercises.length > 0) {
        this.currentExerciseIndex = 0;
        this.displayCurrentExercise();
    } else {
        this.practiceCompletionMessage = "No se encontraron ejercicios de práctica para este conjunto de palabras.";
        this.currentExercise = null; // Ensure no exercise is displayed
    }
    this.isLoadingPractice = false;
}

export function displayCurrentExercise() {
    this.userAnswer = null;
    this.feedbackMessage = { type: '', text: '' };
    if (this.currentExerciseIndex >= 0 && this.currentExerciseIndex < this.practiceExercises.length) {
        this.currentExercise = this.practiceExercises[this.currentExerciseIndex];
        console.log("Displaying exercise:", this.currentExerciseIndex + 1, this.currentExercise);
    } else {
        this.currentExercise = null;
        this.practiceCompletionMessage = this.practiceExercises.length > 0 ? "¡Sesión de práctica completada! Bien hecho." : "No había ejercicios disponibles para esta sesión.";
        console.log("Practice session ended or no exercises.");
    }
}

export function selectAnswer(option) {
    if (this.feedbackMessage.text === '') {
        this.userAnswer = option;
    }
}

export function submitAnswer() {
    if (!this.userAnswer || !this.currentExercise) return;
    if (this.userAnswer === this.currentExercise.correctAnswerTerm) {
        this.feedbackMessage = { type: 'success', text: '¡Bien hecho!' };
    } else {
        this.feedbackMessage = { type: 'error', text: `La respuesta correcta era ${this.currentExercise.correctAnswerTerm}` };
    }
}

export function nextExercise() {
    if (this.currentExerciseIndex < this.practiceExercises.length - 1) {
        this.currentExerciseIndex++;
        this.displayCurrentExercise();
    } else {
        this.displayCurrentExercise(); // Sets currentExercise to null
    }
}

export function finishPracticeSession() {
    this.isPracticeActive = false;
    this.currentView = 'menu';
} 