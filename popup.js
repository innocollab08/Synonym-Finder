document.addEventListener("DOMContentLoaded", () => {
  // Theme initialization
  initializeTheme();

  const output = document.getElementById("output");
  const { GEMINI_API_KEY: apiKey, GEMINI_API_URL: apiUrl } = window.config;

  // Get word of the day
  getWordOfDay(apiKey, apiUrl);

  // Set up tab switching
  const tabButtons = document.querySelectorAll(".tab-button");
  tabButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      openTab(event, button.dataset.tab);
    });
  });

  // Set up search button listener
  document
    .getElementById("searchButton")
    .addEventListener("click", () => searchWord(apiKey, apiUrl));

  // Set up input enter key listener
  document.getElementById("searchInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      searchWord(apiKey, apiUrl);
    }
  });

  // Handle word selection message
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "wordSelected") {
      const word = message.word;
      console.log("Word selected:", word);

      const output = document.getElementById("output");
      if (!output) {
        console.error("Output element not found");
        return;
      }

      output.innerHTML = `Fetching synonyms for: <b>${word}</b>`;
      fetchSynonyms(word, apiKey, apiUrl);
    }
  });

  // Check for stored word
  chrome.storage.local.get(["selectedWord"], (result) => {
    if (result.selectedWord) {
      const output = document.getElementById("output");
      if (!output) {
        console.error("Output element not found");
        return;
      }

      output.innerHTML = `Fetching synonyms for: <b>${result.selectedWord}</b>`;
      fetchSynonyms(result.selectedWord, apiKey, apiUrl);
      chrome.storage.local.remove("selectedWord");
    }
  });

  setupCopyButtons();

  // Show selected text tab by default
  document.getElementById("selectedText").style.display = "block";
  document.getElementById("search").style.display = "none";
  document.getElementById("wordOfDay").style.display = "none";

  setupPronunciation();
});

// Tab switching function
function openTab(event, tabName) {
  const tabContents = document.getElementsByClassName("tab-content");
  for (let content of tabContents) {
    content.style.display = "none";
  }

  const tabButtons = document.getElementsByClassName("tab-button");
  for (let button of tabButtons) {
    button.classList.remove("active");
  }

  document.getElementById(tabName).style.display = "block";
  event.currentTarget.classList.add("active");
}

// Function to fetch synonyms for selected text
async function fetchSynonyms(word, apiKey, apiUrl) {
  const output = document.getElementById("output");
  const synonymsList = document.getElementById("synonymsList");
  const antonymsList = document.getElementById("antonymsList");
  const results = document.getElementById("results");

  // Check if required elements exist
  if (!output || !synonymsList || !antonymsList || !results) {
    console.error("Required DOM elements not found:", {
      output: !!output,
      synonymsList: !!synonymsList,
      antonymsList: !!antonymsList,
      results: !!results,
    });
    return;
  }

  try {
    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Please provide synonyms and antonyms for the word "${word}" in the following JSON format:
            {
              "synonyms": ["word1", "word2", "word3"],
              "antonyms": ["word1", "word2", "word3"]
            }`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
      throw new Error("Invalid response format");
    }

    const result = data.candidates[0].content.parts[0].text;

    // Extract JSON from the response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    // Parse the JSON
    const parsedResult = JSON.parse(jsonMatch[0]);

    if (!parsedResult.synonyms || !parsedResult.antonyms) {
      throw new Error("Missing synonyms or antonyms in response");
    }

    // Update status
    output.innerHTML = `Results for: <b>${word}</b>`;

    // Show results container
    results.style.display = "block";

    // Update synonyms
    synonymsList.innerHTML = parsedResult.synonyms
      .map((word) => `<span class="word-chip">${word}</span>`)
      .join("");

    // Update antonyms
    antonymsList.innerHTML = parsedResult.antonyms
      .map((word) => `<span class="word-chip">${word}</span>`)
      .join("");
  } catch (error) {
    console.error("Error details:", error);
    output.innerHTML = "Error fetching results. Please try again.";
    synonymsList.innerHTML = "";
    antonymsList.innerHTML = "";
    results.style.display = "none";
  }
}

// Function to search for synonyms manually
async function searchWord(apiKey, apiUrl) {
  const searchInput = document.getElementById("searchInput");
  const word = searchInput.value.trim();

  if (!word) {
    return;
  }

  const searchSynonymsList = document.getElementById("searchSynonymsList");
  const searchAntonymsList = document.getElementById("searchAntonymsList");
  const searchResults = document.getElementById("searchResults");

  // Show loading state
  searchSynonymsList.innerHTML = "Loading...";
  searchAntonymsList.innerHTML = "Loading...";

  // Make sure search results are visible
  searchResults.style.display = "block";

  try {
    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Please provide synonyms and antonyms for the word "${word}" in the following JSON format only:
                        {
                            "synonyms": ["word1", "word2", "word3"],
                            "antonyms": ["word1", "word2", "word3"]
                        }`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const result = data.candidates[0].content.parts[0].text;

    try {
      const jsonStr = result.substring(
        result.indexOf("{"),
        result.lastIndexOf("}") + 1
      );
      const parsedResult = JSON.parse(jsonStr);

      // Update synonyms
      searchSynonymsList.innerHTML = parsedResult.synonyms
        .map((word) => `<span class="word-chip">${word}</span>`)
        .join("");

      // Update antonyms
      searchAntonymsList.innerHTML = parsedResult.antonyms
        .map((word) => `<span class="word-chip">${word}</span>`)
        .join("");

      // Make sure copy buttons are set up
      setupCopyButtons();
    } catch (parseError) {
      searchSynonymsList.innerHTML = "Error parsing results";
      searchAntonymsList.innerHTML = "Error parsing results";
      console.error(parseError);
    }
  } catch (error) {
    searchSynonymsList.innerHTML = "Error fetching data";
    searchAntonymsList.innerHTML = "Error fetching data";
    console.error(error);
  }
}

function setupCopyButtons() {
  const copyButtons = document.querySelectorAll(".copy-btn");

  copyButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.type;
      const isSearch = button.closest("#search") !== null;
      const currentWord = isSearch
        ? document.getElementById("searchInput").value.trim()
        : document.getElementById("output").querySelector("b")?.textContent;

      if (!currentWord) return;

      const listId = isSearch
        ? type === "synonyms"
          ? "searchSynonymsList"
          : "searchAntonymsList"
        : type === "synonyms"
        ? "synonymsList"
        : "antonymsList";

      const wordList = document.getElementById(listId);
      const words = Array.from(wordList.querySelectorAll(".word-chip"))
        .map((chip) => chip.textContent)
        .filter((word) => word);

      if (words.length === 0) return;

      const copyText = `Word "${currentWord}" ${type} are: ${words.join(", ")}`;

      try {
        await navigator.clipboard.writeText(copyText);

        // Visual feedback
        const originalColor = button.style.color;
        button.style.color = "#4CAF50";
        setTimeout(() => {
          button.style.color = originalColor;
        }, 1000);
      } catch (err) {
        console.error("Failed to copy text:", err);
      }
    });
  });
}

// Function to get word of the day
async function getWordOfDay(apiKey, apiUrl) {
  const dailyWord = document.getElementById("dailyWord");
  const wordDate = document.getElementById("wordDate");
  const wordMeaning = document.getElementById("wordMeaning");
  const dailySynonymsList = document.getElementById("dailySynonymsList");
  const dailyAntonymsList = document.getElementById("dailyAntonymsList");

  // Check if we already have a word for today
  const today = new Date().toDateString();
  const stored = await chrome.storage.local.get(["wordOfDay"]);

  if (stored.wordOfDay && stored.wordOfDay.date === today) {
    displayWordOfDay(stored.wordOfDay);
    return;
  }

  try {
    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Generate a random sophisticated word with its meaning, synonyms, and antonyms in the following JSON format:
            {
              "word": "word",
              "meaning": "detailed meaning of the word",
              "synonyms": ["word1", "word2", "word3"],
              "antonyms": ["word1", "word2", "word3"]
            }`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const result = data.candidates[0].content.parts[0].text;
    const jsonStr = result.substring(
      result.indexOf("{"),
      result.lastIndexOf("}") + 1
    );
    const parsedResult = JSON.parse(jsonStr);

    // Store word of the day
    const wordOfDay = {
      ...parsedResult,
      date: today,
    };

    await chrome.storage.local.set({ wordOfDay });
    displayWordOfDay(wordOfDay);
  } catch (error) {
    dailyWord.textContent = "Error loading word of the day";
    console.error(error);
  }
}

function displayWordOfDay(data) {
  const dailyWord = document.getElementById("dailyWord");
  const wordDate = document.getElementById("wordDate");
  const wordMeaning = document.getElementById("wordMeaning");
  const dailySynonymsList = document.getElementById("dailySynonymsList");
  const dailyAntonymsList = document.getElementById("dailyAntonymsList");

  dailyWord.textContent = data.word;
  wordDate.textContent = new Date(data.date).toLocaleDateString();
  wordMeaning.textContent = data.meaning;

  dailySynonymsList.innerHTML = data.synonyms
    .map((word) => `<span class="word-chip">${word}</span>`)
    .join("");

  dailyAntonymsList.innerHTML = data.antonyms
    .map((word) => `<span class="word-chip">${word}</span>`)
    .join("");
}

function initializeTheme() {
  const themeToggle = document.getElementById("themeToggle");

  // Check system preference
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  // Check stored preference
  chrome.storage.local.get(["theme"], function (result) {
    const storedTheme = result.theme;

    if (storedTheme) {
      document.documentElement.setAttribute("data-theme", storedTheme);
    } else {
      // Use system preference if no stored preference
      const initialTheme = prefersDark ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", initialTheme);
      chrome.storage.local.set({ theme: initialTheme });
    }
  });

  // Listen for system theme changes
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!chrome.storage.local.get(["theme"])) {
        const newTheme = e.matches ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", newTheme);
        chrome.storage.local.set({ theme: newTheme });
      }
    });

  // Theme toggle button click handler
  themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", newTheme);
    chrome.storage.local.set({ theme: newTheme });
  });
}

function setupPronunciation() {
  const pronounceButtons = document.querySelectorAll(".pronounce-btn");
  const synth = window.speechSynthesis;

  pronounceButtons.forEach((button) => {
    button.addEventListener("click", () => {
      let wordToSpeak = "";

      // Get the word based on which button was clicked
      if (button.id === "pronounceSelected") {
        const selectedWordElement = document
          .getElementById("output")
          .querySelector("b");
        if (selectedWordElement) {
          wordToSpeak = selectedWordElement.textContent;
        }
      } else if (button.id === "pronounceSearch") {
        wordToSpeak = document.getElementById("searchInput").value.trim();
      } else if (button.id === "pronounceDaily") {
        wordToSpeak = document.getElementById("dailyWord").textContent;
      }

      if (!wordToSpeak) return;

      // Stop any ongoing speech
      synth.cancel();

      // Create and configure utterance
      const utterance = new SpeechSynthesisUtterance(wordToSpeak);
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1;
      utterance.lang = "en-US"; // Set language to English

      // Visual feedback
      button.classList.add("playing");

      // Remove playing class when speech ends
      utterance.onend = () => {
        button.classList.remove("playing");
      };

      // Handle errors
      utterance.onerror = () => {
        button.classList.remove("playing");
        console.error("Speech synthesis failed");
      };

      // Speak the word
      synth.speak(utterance);
    });
  });
}
