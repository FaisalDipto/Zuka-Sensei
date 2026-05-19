document.getElementById('captureBtn').addEventListener('click', async () => {
  const resultDiv = document.getElementById('result');
  resultDiv.innerText = "Zuka Sensei is capturing the screen..."

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 50});

    resultDiv.innerText = "Image captured. Transmitting to Go backennd...";

    const base64Response = await fetch(dataUrl);
    const imageBlob = await base64Response.blob();

    const formData = new FormData();
    formData.append('image', imageBlob, 'screenshot.jpg');
    formData.append('prompt', 'You are Zuka Sensei, a highly intelligent AI assistant. Briefly describe what the user is currently looking at on their screen.');

    const backendResponse = await fetch('http://localhost:8080/api/vision', {
      method: 'POST',
      body: formData
    });

    if (!backendResponse.ok) {
      throw new Error(`Server rejected request: ${backendResponse.status}`);
    }

    const data = await backendResponse.json();
    resultDiv.innerText = data.answer;
  } catch (error) {
    console.error("System Failures:", error)
    resultDiv.innerText = "Connection failed. Is the Go server running?";
  }
});