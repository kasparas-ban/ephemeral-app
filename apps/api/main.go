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

var upgrader = websocket.Upgrader{
	ReadBufferSize:    1024,
	WriteBufferSize:   1024,
	EnableCompression: true,
	CheckOrigin:       checkOrigin,
}

type config struct {
	Addr           string
	AllowedOrigins map[string]struct{}
}

var allowedOrigins map[string]struct{}

func main() {
	// Local convenience only; real environment variables still take priority.
	_ = godotenv.Load(".env.local", ".env")

	cfg, err := loadConfig()
	if err != nil {
		log.Fatal(err)
	}
	allowedOrigins = cfg.AllowedOrigins

	// Create hub
	hub := realtime.NewHub()
	go hub.Run()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/connect", websocketHandler(hub))

	fmt.Println("Go API listening on", cfg.Addr)
	log.Fatal(http.ListenAndServe(cfg.Addr, mux))
}

func loadConfig() (config, error) {
	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		return config{}, fmt.Errorf("PORT is not set")
	}

	origins := parseAllowedOrigins(os.Getenv("ALLOWED_ORIGINS"))
	if len(origins) == 0 {
		return config{}, fmt.Errorf("ALLOWED_ORIGINS is not set")
	}

	return config{
		Addr:           ":" + port,
		AllowedOrigins: origins,
	}, nil
}

func parseAllowedOrigins(value string) map[string]struct{} {
	origins := make(map[string]struct{})
	for origin := range strings.SplitSeq(value, ",") {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			origins[origin] = struct{}{}
		}
	}

	return origins
}

func checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return false
	}

	_, ok := allowedOrigins[origin]
	return ok
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]string{"status": "ok"}); err != nil {
		log.Printf("Error encoding health response: %v", err)
	}
}

func websocketHandler(hub *realtime.Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		client := realtime.NewClient(hub, conn)
		hub.Register(client)

		go client.WritePump()
		go client.ReadPump()
	}
}
