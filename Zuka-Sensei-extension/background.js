chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // Command 1: Take the full screenshot
    if (request.action === "CAPTURE_SCREEN") {
        chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 100 }, (dataUrl) => {
            sendResponse({ imageBase64: dataUrl });
        });
        return true;
    }

    // Command 2: Talk to the Go Server (Safe from CORS/PNA blocks)
    if (request.action === "ANALYZE_IMAGE") {
        (async () => {
            try {
                // 1. Convert the Base64 image back into a Binary Blob
                const base64Response = await fetch(request.image);
                const imageBlob = await base64Response.blob();

                // 2. Package the payload
                const formData = new FormData();
                formData.append('image', imageBlob, 'cropped.jpg');
                formData.append('prompt', request.prompt);

                // 3. Fire at the local Go server
                const backendResponse = await fetch('http://localhost:8080/api/vision', {
                    method: 'POST',
                    body: formData
                });

                if (!backendResponse.ok) throw new Error("Go Server Error");

                const data = await backendResponse.json();

                // 4. Send the text answer back to the Content Script
                sendResponse({ status: "success", answer: data.answer });

            } catch (error) {
                console.error("Background Network Error:", error);
                sendResponse({ status: "error", answer: "Failed to connect to Go backend." });
            }
        })();

        return true; // Keeps the message channel open while we wait for the Go server!
    }
});