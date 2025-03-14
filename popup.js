document.addEventListener("DOMContentLoaded", () => {
  // Theme initialization
  initializeTheme();

  const output = document.getElementById("output");

  // Get word of the day using background script
  chrome.runtime
    .sendMessage({ action: "getWordOfDay" })
    .then((response) => {
      if (response.error) {
        throw new Error(response.error);
      }
      displayWordOfDay(response);
    })
    .catch((error) => {
      console.error("Error fetching word of day:", error);
      document.getElementById("dailyWord").textContent =
        "Error loading word of the day";
    });

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
    .addEventListener("click", () => searchWord());

  // Set up input enter key listener
  document.getElementById("searchInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      searchWord();
    }
  });

  // Handle word selection message
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "wordSelected") {
      const word = message.word;
      console.log("Word selected:", word);

      const output = document.getElementById("output");
      if (!output) {
        console.error("Output element not found");
        return;
      }

      // Show the selected text tab
      const tabButtons = document.querySelectorAll(".tab-button");
      tabButtons.forEach((button) => {
        if (button.dataset.tab === "selectedText") {
          button.click();
        }
      });

      output.innerHTML = `Fetching synonyms for: <b>${word}</b>`;
      fetchSynonyms(word);
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
      fetchSynonyms(result.selectedWord);
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
async function fetchSynonyms(word) {
  const synonymsList = document.getElementById("synonymsList");
  const antonymsList = document.getElementById("antonymsList");
  const results = document.getElementById("results");
  const selectedWordDisplay = document.getElementById("selectedWordDisplay");

  try {
    // Show loading state
    synonymsList.innerHTML = '<span class="loading">Loading...</span>';
    antonymsList.innerHTML = '<span class="loading">Loading...</span>';
    results.style.display = "block";
    
    // Display the selected word in the header
    if (selectedWordDisplay) {
      selectedWordDisplay.textContent = word;
    }

    const response = await chrome.runtime.sendMessage({
      action: "fetchSynonyms",
      word: word,
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const result = response.candidates[0].content.parts[0].text;
    const jsonMatch = result.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Invalid response format");
    }

    const parsedResult = JSON.parse(jsonMatch[0]);

    // Update synonyms
    synonymsList.innerHTML =
      parsedResult.synonyms.length > 0
        ? parsedResult.synonyms
            .map((word) => `<span class="word-chip">${word}</span>`)
            .join("")
        : "<span class='no-results'>No synonyms found</span>";

    // Update antonyms
    antonymsList.innerHTML =
      parsedResult.antonyms.length > 0
        ? parsedResult.antonyms
            .map((word) => `<span class="word-chip">${word}</span>`)
            .join("")
        : "<span class='no-results'>No antonyms found</span>";

    // Show results
    results.style.display = "block";
  } catch (error) {
    console.error("Error fetching synonyms:", error);
    synonymsList.innerHTML = "<span class='error'>Error fetching data</span>";
    antonymsList.innerHTML = "<span class='error'>Error fetching data</span>";
    results.style.display = "block";
  }
}

// Function to search for synonyms manually
async function searchWord() {
  const searchInput = document.getElementById("searchInput");
  const word = searchInput.value.trim();

  if (!word) {
    return;
  }

  const searchSynonymsList = document.getElementById("searchSynonymsList");
  const searchAntonymsList = document.getElementById("searchAntonymsList");
  const searchResults = document.getElementById("searchResults");

  try {
    // Show loading state
    searchSynonymsList.innerHTML = '<span class="loading">Loading...</span>';
    searchAntonymsList.innerHTML = '<span class="loading">Loading...</span>';
    searchResults.style.display = "block";

    const response = await chrome.runtime.sendMessage({
      action: "fetchSynonyms",
      word: word,
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const result = response.candidates[0].content.parts[0].text;
    const jsonMatch = result.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Invalid response format");
    }

    const parsedResult = JSON.parse(jsonMatch[0]);

    // Update synonyms
    searchSynonymsList.innerHTML =
      parsedResult.synonyms.length > 0
        ? parsedResult.synonyms
            .map((word) => `<span class="word-chip">${word}</span>`)
            .join("")
        : "<span class='no-results'>No synonyms found</span>";

    // Update antonyms
    searchAntonymsList.innerHTML =
      parsedResult.antonyms.length > 0
        ? parsedResult.antonyms
            .map((word) => `<span class="word-chip">${word}</span>`)
            .join("")
        : "<span class='no-results'>No antonyms found</span>";

    // Make sure copy buttons are set up
    setupCopyButtons();
  } catch (error) {
    console.error("Search error:", error);
    searchSynonymsList.innerHTML =
      "<span class='error'>Error fetching data</span>";
    searchAntonymsList.innerHTML =
      "<span class='error'>Error fetching data</span>";
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

function displayWordOfDay(response) {
  try {
    const result = response.candidates[0].content.parts[0].text;
    const jsonMatch = result.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Invalid response format");
    }

    const parsedResult = JSON.parse(jsonMatch[0]);

    const dailyWord = document.getElementById("dailyWord");
    const wordDate = document.getElementById("wordDate");
    const wordMeaning = document.getElementById("wordMeaning");
    const dailySynonymsList = document.getElementById("dailySynonymsList");
    const dailyAntonymsList = document.getElementById("dailyAntonymsList");

    // Update UI elements
    dailyWord.textContent = parsedResult.word;
    wordDate.textContent = new Date().toLocaleDateString();
    wordMeaning.textContent = parsedResult.meaning;

    // Update synonyms
    dailySynonymsList.innerHTML = parsedResult.synonyms
      .map((word) => `<span class="word-chip">${word}</span>`)
      .join("");

    // Update antonyms
    dailyAntonymsList.innerHTML = parsedResult.antonyms
      .map((word) => `<span class="word-chip">${word}</span>`)
      .join("");

    // Make word pronounceable
    setupPronunciation();
  } catch (error) {
    console.error("Error displaying word of day:", error);
    document.getElementById("dailyWord").textContent =
      "Error loading word of the day";
  }
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
  
  // Check if speech synthesis is supported
  if (!window.speechSynthesis) {
    pronounceButtons.forEach(button => {
      button.style.display = 'none';
    });
    console.log('Speech synthesis not supported');
    return;
  }

  const synth = window.speechSynthesis;

  pronounceButtons.forEach((button) => {
    button.addEventListener("click", async () => {
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

      try {
        // Stop any ongoing speech
        synth.cancel();

        // Create and configure utterance
        const utterance = new SpeechSynthesisUtterance(wordToSpeak);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.lang = "en-US";

        // Get available voices
        let voices = synth.getVoices();
        
        // If voices aren't loaded yet, wait for them
        if (voices.length === 0) {
          await new Promise(resolve => {
            speechSynthesis.addEventListener('voiceschanged', () => {
              voices = synth.getVoices();
              resolve();
            }, { once: true });
          });
        }

        // Try to find an English voice
        const englishVoice = voices.find(voice => 
          voice.lang.startsWith('en-') && !voice.localService
        ) || voices[0];

        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        // Visual feedback
        button.classList.add("playing");

        // Remove playing class when speech ends
        utterance.onend = () => {
          button.classList.remove("playing");
        };

        // Handle errors
        utterance.onerror = (event) => {
          button.classList.remove("playing");
          console.log('Speech synthesis error:', event.error);
          // Optionally show a user-friendly message
          button.setAttribute('title', 'Speech synthesis unavailable');
        };

        // Speak the word
        synth.speak(utterance);
      } catch (error) {
        console.log('Speech synthesis error:', error);
        button.classList.remove("playing");
        button.setAttribute('title', 'Speech synthesis unavailable');
      }
    });
  });
}

// Function to get word of the day
async function getWordOfDay() {
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
    const response = await chrome.runtime.sendMessage({
      action: "getWordOfDay",
    });

    if (response.error) {
      throw new Error(response.error);
    }

    const result = response.candidates[0].content.parts[0].text;
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
