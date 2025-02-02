// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("Synonyms Finder extension installed");
});

// API key and URL (stored securely in background script)
const GEMINI_API_KEY = "AIzaSyCU0w3DGO7aoT0g_TVPiM79gFHfc_51M1o"; // Replace with your actual API key
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

// Add API key to headers
const headers = {
  "Content-Type": "application/json",
  "x-goog-api-key": GEMINI_API_KEY,
};

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "wordSelected") {
    chrome.storage.local.set({ selectedWord: request.word });
  } else if (request.action === "fetchSynonyms") {
    fetchSynonymsSecure(request.word)
      .then((response) => {
        if (response.error) {
          sendResponse({ error: response.error });
        } else {
          sendResponse(response);
        }
      })
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  } else if (request.action === "getWordOfDay") {
    getWordOfDaySecure()
      .then((response) => {
        if (response.error) {
          sendResponse({ error: response.error });
        } else {
          sendResponse(response);
        }
      })
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});

// Secure API call function for synonyms with retry logic
async function fetchSynonymsSecure(word, retryCount = 3) {
  for (let i = 0; i < retryCount; i++) {
    try {
      const response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Generate synonyms and antonyms for the word "${word}" in this exact JSON format without any additional text: {"synonyms":["word1","word2","word3"],"antonyms":["word1","word2","word3"]}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, details: ${errorText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (i === retryCount - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Word of Day secure API call with caching
async function getWordOfDaySecure() {
  try {
    // Check cache first
    const { wordOfDay, timestamp } =
      (await chrome.storage.local.get(["wordOfDay", "timestamp"])) || {};
    const now = Date.now();

    if (wordOfDay && timestamp && now - timestamp < 24 * 60 * 60 * 1000) {
      return wordOfDay;
    }

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Generate a random sophisticated word with its meaning, synonyms, and antonyms in this exact JSON format without any additional text: {"word":"word","meaning":"detailed meaning","synonyms":["word1","word2","word3"],"antonyms":["word1","word2","word3"]}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Cache the result
    await chrome.storage.local.set({
      wordOfDay: data,
      timestamp: now,
    });

    return data;
  } catch (error) {
    console.error("API Error:", error);
    throw error;
  }
}
