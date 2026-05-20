document.getElementById('captureBtn').addEventListener('click', async () => {
    const chatLog = document.getElementById('chatLog');
    const inputField = document.getElementById('promptInput');

    // 1. Grab the user's text. If they leave it blank, provide a fallback command.
    const customPrompt = inputField.value.trim() || "Describe what is on this screen in detail.";

    // 2. Build and inject the User's Chat Bubble
    const userDiv = document.createElement('div');
    userDiv.className = 'message user-msg';
    userDiv.innerText = customPrompt;
    chatLog.appendChild(userDiv);

    // Clear the input box and force the chat window to scroll to the very bottom
    inputField.value = '';
    chatLog.scrollTop = chatLog.scrollHeight;

    // 3. Build and inject the AI's "Loading" Bubble
    const aiDiv = document.createElement('div');
    aiDiv.className = 'message ai-msg';
    aiDiv.innerText = "Zuka Sensei is observing...";
    chatLog.appendChild(aiDiv);
    chatLog.scrollTop = chatLog.scrollHeight;

    try {
        // --- PHASE 2: CAPTURE ---
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 50 });
        aiDiv.innerText = "Transmitting to backend...";

        // --- PHASE 3: NETWORK ---
        const base64Response = await fetch(dataUrl);
        const imageBlob = await base64Response.blob();

        const formData = new FormData();
        formData.append('image', imageBlob, 'screenshot.jpg');
        // We dynamically inject the user's custom question here!
        formData.append('prompt', 'You are Zuka Sensei. ' + customPrompt);

        const backendResponse = await fetch('http://localhost:8080/api/vision', {
            method: 'POST',
            body: formData
        });

        if (!backendResponse.ok) throw new Error(`Server error: ${backendResponse.status}`);

        // --- PHASE 4: DISPLAY ---
        const data = await backendResponse.json();

        // 4. Update the exact same loading bubble with the final text from Go!
        aiDiv.innerText = data.answer;

    } catch (error) {
        console.error(error);
        aiDiv.innerText = "System Failure: Could not establish link with the Go server.";
    }

    chatLog.scrollTop = chatLog.scrollHeight;
});