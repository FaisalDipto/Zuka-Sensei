console.log("Zuka Sensei Chatbot Script loaded.");

// 1. Core UI Elements
const triggerBtn = document.createElement('div');
triggerBtn.id = 'zuka-trigger-btn';
triggerBtn.innerText = '🤖';

const overlay = document.createElement('div');
overlay.id = 'zuka-overlay';

const selectionBox = document.createElement('div');
selectionBox.id = 'zuka-selection';

// 2. The Chatbot Panel HTML
const panel = document.createElement('div');
panel.id = 'zuka-panel';
panel.innerHTML = `
    <div id="zuka-header">
        <span>Zuka Sensei 🤖</span>
        <span id="zuka-close">✖</span>
    </div>
    <div id="zuka-chat-log">
        <div class="zuka-msg zuka-ai">System online. Click the 🤖 button to capture an area of your screen.</div>
    </div>
    <div id="zuka-input-dock">
        <input type="text" id="zuka-prompt" placeholder="Ask a question about the image..." autocomplete="off"/>
        <button id="zuka-ask-btn">Ask</button>
    </div>
`;

// Inject into DOM
document.body.appendChild(triggerBtn);
document.body.appendChild(overlay);
document.body.appendChild(selectionBox);
document.body.appendChild(panel);

// --- STATE MANAGEMENT ---
let stagedImageBase64 = null; // This holds our cropped image while we wait for the user's text!
let isDrawing = false;
let startX = 0, startY = 0;

// Panel Controls
document.getElementById('zuka-close').addEventListener('click', () => panel.classList.remove('open'));
const chatLog = document.getElementById('zuka-chat-log');
const promptInput = document.getElementById('zuka-prompt');
const askBtn = document.getElementById('zuka-ask-btn');

// --- PHASE 1: THE CAPTURE ---
triggerBtn.addEventListener('click', () => {
    panel.classList.remove('open'); // 1. Slide the chat panel away
    triggerBtn.style.display = 'none'; // 2. Hide the robot button itself!
    document.body.style.overflow = 'hidden'; // 3. Freeze the webpage so it cannot scroll
    overlay.style.display = 'block';
});

overlay.addEventListener('mousedown', (e) => {
    isDrawing = true;
    startX = e.clientX; startY = e.clientY;
    selectionBox.style.left = startX + 'px'; selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0px'; selectionBox.style.height = '0px';
    selectionBox.style.display = 'block';
});

overlay.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const currentX = e.clientX; const currentY = e.clientY;
    selectionBox.style.left = (currentX < startX ? currentX : startX) + 'px';
    selectionBox.style.top = (currentY < startY ? currentY : startY) + 'px';
    selectionBox.style.width = Math.abs(currentX - startX) + 'px';
    selectionBox.style.height = Math.abs(currentY - startY) + 'px';
});

overlay.addEventListener('mouseup', async (e) => {
    isDrawing = false;
    overlay.style.display = 'none';

    // RESTORE THE UI AND UNFREEZE THE SCREEN
    document.body.style.overflow = ''; // Unfreeze the webpage scroll
    triggerBtn.style.display = 'flex'; // Bring the robot button back

    const rect = selectionBox.getBoundingClientRect();
    selectionBox.style.display = 'none';

    if (rect.width < 10 || rect.height < 10) return;

    triggerBtn.innerText = '⏳';

    chrome.runtime.sendMessage({ action: "CAPTURE_SCREEN" }, (response) => {
        if (!response || !response.imageBase64) {
            triggerBtn.innerText = '🤖';
            return;
        }

        const img = new Image();
        img.src = response.imageBase64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = rect.width; canvas.height = rect.height;
            const ctx = canvas.getContext('2d');
            const dpr = window.devicePixelRatio || 1;

            ctx.drawImage(img, rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr, 0, 0, rect.width, rect.height);

            stagedImageBase64 = canvas.toDataURL('image/jpeg', 0.8);

            triggerBtn.innerText = '🤖';
            panel.classList.add('open');
            promptInput.focus();

            chatLog.innerHTML += `<div class="zuka-msg zuka-system">📸 Visual data captured and staged.</div>`;
            chatLog.scrollTop = chatLog.scrollHeight;
        };
    });
});

// --- PHASE 2: THE CONVERSATION ---
askBtn.addEventListener('click', () => {
    const customPrompt = promptInput.value.trim() || "Analyze this image.";
    if (!stagedImageBase64) {
        alert("Please capture an image using the 🤖 button first!");
        return;
    }

    // 1. Add User text to chat
    chatLog.innerHTML += `<div class="zuka-msg zuka-user">${customPrompt}</div>`;
    promptInput.value = '';

    // 2. Add AI Loading state
    const loadingId = 'loading-' + Date.now();
    chatLog.innerHTML += `<div id="${loadingId}" class="zuka-msg zuka-ai">Thinking...</div>`;
    chatLog.scrollTop = chatLog.scrollHeight;

    // 3. Fire BOTH the staged image and the user's text to the Background Worker
    chrome.runtime.sendMessage({
        action: "ANALYZE_IMAGE",
        image: stagedImageBase64,
        prompt: customPrompt
    }, (aiResponse) => {

        const loadingBubble = document.getElementById(loadingId);

        if (aiResponse.status === "success") {
            loadingBubble.innerText = aiResponse.answer;
        } else {
            loadingBubble.innerText = "System Failure: Could not connect to Go Backend.";
            loadingBubble.style.color = "red";
        }

        // Clear the state so they can capture a new image!
        stagedImageBase64 = null;
        chatLog.scrollTop = chatLog.scrollHeight;
    });
});

// Allow pressing "Enter" to send the message
promptInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') askBtn.click();
});