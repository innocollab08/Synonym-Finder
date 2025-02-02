// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Synonyms Finder extension installed');
  });

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'wordSelected') {
        // Store the word
        chrome.storage.local.set({ selectedWord: request.word });
    }
    return true;
});