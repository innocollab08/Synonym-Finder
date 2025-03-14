(() => {
    // Create a floating element for the "Define" button
    const defineButton = document.createElement('div');
    defineButton.id = 'synonym-finder-define-btn';
    defineButton.textContent = 'Define';
    defineButton.style.cssText = `
        position: absolute;
        background-color: #4285f4;
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        z-index: 9999;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        display: none;
        font-family: Arial, sans-serif;
        transition: opacity 0.2s ease;
    `;
    document.body.appendChild(defineButton);

    // Track the currently selected word
    let currentSelectedWord = '';

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

    // Function to open the extension popup programmatically
    function openExtensionPopup() {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'openPopup'
                });
            }
        } catch (error) {
            console.log('Failed to open extension popup:', error);
        }
    }

    // Position the define button near the selected text
    function positionDefineButton(selection) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        // Position above or below based on available space
        const spaceAbove = rect.top > 40;
        
        defineButton.style.left = `${rect.left + window.scrollX}px`;
        
        if (spaceAbove) {
            // Position above the selection
            defineButton.style.top = `${rect.top + window.scrollY - 30}px`;
        } else {
            // Position below the selection
            defineButton.style.top = `${rect.bottom + window.scrollY + 5}px`;
        }
        
        defineButton.style.display = 'block';
    }

    // Handle mouse up event to detect text selection
    document.addEventListener('mouseup', (event) => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        // Hide the define button if click is on the button itself
        if (event.target === defineButton) {
            return;
        }
        
        // Hide the define button when clicking elsewhere with no selection
        if (!selectedText || selectedText.length === 0) {
            defineButton.style.display = 'none';
            return;
        }
        
        // Only show the define button for single words
        if (selectedText && selectedText.length > 0 && !selectedText.includes(' ')) {
            currentSelectedWord = selectedText;
            sendWordToExtension(selectedText);
            positionDefineButton(selection);
        } else {
            defineButton.style.display = 'none';
        }
    });

    // Handle click on the define button
    defineButton.addEventListener('click', () => {
        if (currentSelectedWord) {
            // Send the word to the extension
            sendWordToExtension(currentSelectedWord);
            
            // Try to open the extension popup
            openExtensionPopup();
            
            // Hide the define button
            defineButton.style.display = 'none';
        }
    });

    // Hide the define button when scrolling
    window.addEventListener('scroll', () => {
        defineButton.style.display = 'none';
    });
})();
