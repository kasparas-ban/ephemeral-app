package main

import (
	"api/realtime"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

func checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return false
	}

	// Allow explicit list via env
	for a := range strings.SplitSeq(os.Getenv("ALLOWED_ORIGINS"), ",") {
		if strings.TrimSpace(a) == origin {
			return true
		}
	}

	return false
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:    1024,
	WriteBufferSize:   1024,
	EnableCompression: true,
	CheckOrigin:       checkOrigin,
}

func main() {
	// Load env files
	_ = godotenv.Load(".env")
	_ = godotenv.Overload(".env.local")

	// Create hub
	hub := realtime.NewHub()
	go hub.Run()

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]string{"status": "ok"}); err != nil {
			log.Printf("Error encoding health response: %v", err)
		}
	})

	http.HandleFunc("/connect", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		client := realtime.NewClient(hub, conn)
		hub.Register(client)

		go client.WritePump()
		go client.ReadPump()
	})

	port := os.Getenv("PORT")
	if port == "" {
		log.Fatal("PORT is not set")
	}
	addr := "localhost:" + port
	fmt.Println("Go API listening on", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
