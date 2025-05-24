export function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
    return array;
}

export function getYouTubeVideoId(url) {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

export function formatSentenceWithBlank(sentence, answerLength = 10) {
    if (!sentence) return '';
    const blankPlaceholder = `<span class="inline-block border-b-2 border-gray-400 mx-1" style="min-width: ${Math.max(50, answerLength * 8)}px;"></span>`;
    return sentence.replace(/___BLANK___/g, blankPlaceholder);
} 