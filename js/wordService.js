// import { TARGET_LANGUAGE_CODE } from './config.js'; // Not needed here anymore for these functions
// getYouTubeVideoId is in utils.js

// Note: `this` in these functions will refer to the Alpine component instance (appState)

// selectWord, clearWordDetails, loadWordDetails are now handled within appState (showWordDetail, loadWordDetailsById)

export function playAudio(audioData) {
    if (!audioData) {
        console.warn("No audio data to play.");
        return;
    }
    try {
        // Assuming audioData is a Blob or ArrayBuffer from the database
        let blob;
        if (audioData instanceof Blob) {
            blob = audioData;
        } else if (audioData instanceof ArrayBuffer || audioData instanceof Uint8Array) {
            blob = new Blob([audioData], { type: 'audio/mpeg' }); // Adjust type if necessary
        } else {
            console.error("Unsupported audio data type:", audioData);
            return;
        }

        const url = URL.createObjectURL(blob);
        if (this.audioPlayer) {
            this.audioPlayer.src = url;
            this.audioPlayer.play().catch(e => console.error("Error playing audio:", e));
        } else {
            console.error("Audio player not initialized on appState.");
        }
    } catch (e) {
        console.error("Error processing audio data:", e);
    }
}

// goBackToWordList is now a method in appState in main.js
// getWords is no longer needed here; appState.fetchAllWords handles it. 