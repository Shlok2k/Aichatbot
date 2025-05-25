const chatBody = document.querySelector(".chat-body");
const messageInput = document.querySelector(".message-input");
const sendMessage = document.querySelector("#send-message");
const fileInput = document.querySelector("#file-input");
const fileUploadWrapper = document.querySelector(".file-upload-wrapper");
const fileCancelButton = fileUploadWrapper.querySelector("#file-cancel");
const chatbotToggler = document.querySelector("#chatbot-toggler");
const closeChatbot = document.querySelector("#close-chatbot");

// API setup
const API_KEY = "YOUR-API-KEY"; // Replace with your actual API key
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyBY8Bn8Qs5jASC4PZdgyrivAtUMj_X6k9Q";

// Initialize user message and file data
const userData = {
  message: null,
  file: {
    data: null,
    mime_type: null,
  },
};

// Store chat history
const chatHistory = [];
const initialInputHeight = messageInput.scrollHeight;

// Create message element with dynamic classes and return it
const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

// Utility to add delay between API calls
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Generate bot response using API
const generateBotResponse = async (incomingMessageDiv) => {
  const messageElement = incomingMessageDiv.querySelector(".message-text");

  // Add user message to chat history
  chatHistory.push({
    role: "user",
    parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: userData.file }] : [])],
  });

  // API request options
  const requestOptions = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: chatHistory,
    }),
  };

  try {
    // Fetch bot response from API with retry logic
    const fetchWithRetries = async (retries, delayMs) => {
      for (let i = 0; i < retries; i++) {
        const response = await fetch(API_URL, requestOptions);
        const data = await response.json();

        if (response.ok) return data;

        // Handle quota exceeded error and retry
        if (data.error && data.error.message.includes("Quota exceeded")) {
          console.warn(`Retrying after quota exceeded. Attempt ${i + 1}`);
          await delay(delayMs);
        } else {
          throw new Error(data.error.message);
        }
      }
      throw new Error("Max retries reached. Please try again later.");
    };

    const data = await fetchWithRetries(3, 2000); // 3 retries, 2 seconds delay

    // Extract and display bot's response text
    let apiResponseText = data.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, "$1").trim();

    // Detect and format code blocks (triple backticks)
    apiResponseText = apiResponseText.replace(/```([\s\S]*?)```/g, function(match, code) {
      return `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
    });

    // Convert markdown-style numbered lists to HTML ordered lists
    apiResponseText = apiResponseText.replace(/(?:^|\n)(\d+\. .+(?:\n\d+\. .+)*)/g, function(match, list) {
      const items = list.split(/\n/).map(line => line.replace(/^\d+\. /, '').trim());
      return '<ol>' + items.map(item => `<li>${item}</li>`).join('') + '</ol>';
    });

    // Convert markdown-style bullets to HTML unordered lists
    apiResponseText = apiResponseText.replace(/(?:^|\n)([-*] .+(?:\n[-*] .+)*)/g, function(match, list) {
      const items = list.split(/\n/).map(line => line.replace(/^[-*] /, '').trim());
      return '<ul>' + items.map(item => `<li>${item}</li>`).join('') + '</ul>';
    });

    // Convert remaining line breaks to <br> (except inside <pre> or <ul>/<ol>)
    apiResponseText = apiResponseText.replace(/([^>])\n/g, '$1<br>');

    messageElement.innerHTML = apiResponseText;

    // Add bot response to chat history
    chatHistory.push({
      role: "model",
      parts: [{ text: apiResponseText }],
    });
  } catch (error) {
    // Handle error in API response
    console.log(error);
    messageElement.innerText = error.message || "An error occurred.";
    messageElement.style.color = "#ff0000";
  } finally {
    // Reset user's file data, removing thinking indicator and scroll chat to bottom
    userData.file = {};
    incomingMessageDiv.classList.remove("thinking");
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
  }
};

// Handle outgoing user messages
const handleOutgoingMessage = (e) => {
  e.preventDefault();
  userData.message = messageInput.value.trim();
  messageInput.value = "";
  messageInput.dispatchEvent(new Event("input"));
  fileUploadWrapper.classList.remove("file-uploaded");

  // Create and display user message
  const messageContent = `<div class="message-text"></div>
                          ${userData.file.data ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="attachment" />` : ""}`;

  const outgoingMessageDiv = createMessageElement(messageContent, "user-message");
  outgoingMessageDiv.querySelector(".message-text").innerText = userData.message;
  chatBody.appendChild(outgoingMessageDiv);
  chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });

  // Simulate bot response with thinking indicator after a delay
  setTimeout(() => {
    const messageContent = `<img class="bot-avatar" src="robotic.png" alt="Chatbot Logo" width="50" height="50">
          <div class="message-text">
            <div class="thinking-indicator">
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          </div>`;

    const incomingMessageDiv = createMessageElement(messageContent, "bot-message", "thinking");
    chatBody.appendChild(incomingMessageDiv);
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    generateBotResponse(incomingMessageDiv);
  }, 0);
};

// Adjust input field height dynamically
messageInput.addEventListener("input", () => {
  messageInput.style.height = `${initialInputHeight}px`;
  messageInput.style.height = `${messageInput.scrollHeight}px`;
  document.querySelector(".chat-form").style.borderRadius = messageInput.scrollHeight > initialInputHeight ? "15px" : "32px";
});

// Handle Enter key press for sending messages
messageInput.addEventListener("keydown", (e) => {
  const userMessage = e.target.value.trim();
  if (e.key === "Enter" && !e.shiftKey && userMessage && window.innerWidth > 768) {
    handleOutgoingMessage(e);
  }
});

// Handle file input change and preview the selected file
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    fileInput.value = "";
    fileUploadWrapper.querySelector("img").src = e.target.result;
    fileUploadWrapper.classList.add("file-uploaded");
    const base64String = e.target.result.split(",")[1];

    // Store file data in userData
    userData.file = {
      data: base64String,
      mime_type: file.type,
    };
  };

  reader.readAsDataURL(file);
});

// Cancel file upload
fileCancelButton.addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("file-uploaded");
});

sendMessage.addEventListener("click", (e) => handleOutgoingMessage(e));
document.querySelector("#file-upload").addEventListener("click", () => fileInput.click());
closeChatbot.addEventListener("click", () => document.body.classList.remove("show-chatbot"));
chatbotToggler.addEventListener("click", () => document.body.classList.toggle("show-chatbot"));

document.addEventListener('DOMContentLoaded', function() {
  // --- Chat History Panel Logic ---
  const historyBtn = document.getElementById('history-btn');
  const historyPanel = document.getElementById('chat-history-panel');
  const closeHistoryBtn = document.getElementById('close-history');
  const historyList = document.getElementById('history-list');

  function renderHistoryPanel() {
    const saved = localStorage.getItem('chat_history');
    historyList.innerHTML = '';
    if (!saved) {
      historyList.innerHTML = '<div style="color:#888;">No history found.</div>';
      return;
    }
    try {
      const history = JSON.parse(saved);
      history.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'history-msg ' + (msg.type === 'user' ? 'user' : 'bot');
        div.innerText = msg.text;
        if (msg.attachment) {
          const img = document.createElement('img');
          img.src = msg.attachment;
          img.className = 'attachment';
          img.style.maxWidth = '100%';
          img.style.marginTop = '6px';
          div.appendChild(img);
        }
        historyList.appendChild(div);
      });
    } catch {
      historyList.innerHTML = '<div style="color:#888;">No history found.</div>';
    }
  }

  if (historyBtn && historyPanel && closeHistoryBtn && historyList) {
    historyBtn.addEventListener('click', () => {
      renderHistoryPanel();
      historyPanel.style.display = 'flex';
    });
    closeHistoryBtn.addEventListener('click', () => {
      historyPanel.style.display = 'none';
    });
  }
});
