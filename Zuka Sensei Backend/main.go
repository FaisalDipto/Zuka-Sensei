package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/google/generative-ai-go/genai"
	"github.com/joho/godotenv"
	"google.golang.org/api/option"
)

type ChatRequest struct {
	Prompt string `json:"prompt"`
}

type ChatResponse struct {
	Answer string	`json:"answer"`
	Error string	`json:"error,omitempty"`
}

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Fatal("GEMINI_API_KEY is completely empty. Check your .env file!")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	ctx := context.Background()

	client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}

	defer client.Close()

	http.HandleFunc("/api/chat", handleChat(client))
	fmt.Printf("Gateway Server online. Listening on http://localhost:%s\n", port)

	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatalf("Server crashed: %v", err)
	}
}

func handleChat(client *genai.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed. Use POST.", http.StatusMethodNotAllowed)
			return
		}

		var req ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON format", http.StatusBadRequest)
			return
		}

		model := client.GenerativeModel("gemini-2.5-flash")

		fmt.Printf("Received Prompt: %s\n", req.Prompt)

		resp, err := model.GenerateContent(r.Context(), genai.Text(req.Prompt))
		if err != nil {
			log.Printf("AI Error: %v", err)
			http.Error(w, "Failed to communicate with AI", http.StatusInternalServerError)
			return
		}

		var aiText string
		if len(resp.Candidates) > 0 && len(resp.Candidates[0].Content.Parts) > 0 {
			aiText = fmt.Sprintf("%v", resp.Candidates[0].Content.Parts[0])
		}	else {
			aiText = "The AI returned an empty response."
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(ChatResponse{
			Answer: aiText,
		})
	}
}