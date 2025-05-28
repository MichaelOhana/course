import { TARGET_LANGUAGE_CODE } from './config.js';

export function getInitialState() {
    return {
        db: null,
        isLoading: true,
        isLoadingHtmlViews: true,
        error: null,
        currentView: 'menu', // 'menu', 'word', 'practice'

        // Mobile menu state
        isMobileMenuOpen: false,

        // HTML content for views
        menuViewHtml: '<p class="text-center text-gray-500">Loading menu view...</p>',
        wordDetailViewHtml: '<p class="text-center text-gray-500">Loading word detail view...</p>',
        practiceViewHtml: '<p class="text-center text-gray-500">Loading practice view...</p>',

        modules: [],
        allWordsFlat: [],
        selectedModuleId: null,
        wordsInSelectedModule: [],
        selectedWordId: null,

        // Target language configuration
        targetLanguageCode: TARGET_LANGUAGE_CODE,

        // Current word for the detail view
        currentWord: null,

        isLoadingWordDetails: false,
        selectedWordDetails: {
            term: null,
            definition: null,
            audio_data: null,
            translation: null
        },
        selectedWordExamples: [],
        selectedWordConversations: [],
        selectedWordClips: [],

        audioPlayer: new Audio(),

        // Practice Session State
        viewedWordsInModule: new Set(),
        midModulePracticeCompleted: false,
        endModulePracticeCompleted: false,
        isPracticeActive: false,
        isLoadingPractice: false,
        practiceSessionTitle: '',
        practiceExercises: [],
        currentExerciseIndex: -1,
        currentExercise: null,
        userAnswer: null,
        feedbackMessage: { type: '', text: '' },
        practiceCompletionMessage: '',
    };
} 