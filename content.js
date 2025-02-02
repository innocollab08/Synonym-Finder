(() => {
    function sendWordToExtension(word) {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'wordSelected',
                    word: word
                }).catch(() => {
                    // If message sending fails, try using storage API
                    if (chrome.storage && chrome.storage.local) {
                        chrome.storage.local.set({ selectedWord: word });
                    }
                });
            }
        } catch (error) {
            console.log('Extension communication failed:', error);
        }
    }

    document.addEventListener('mouseup', () => {
        const selectedText = window.getSelection().toString().trim();
        if (selectedText && selectedText.length > 0) {
            sendWordToExtension(selectedText);
        }
    });
})();
