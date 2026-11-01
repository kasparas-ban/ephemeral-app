package main

import (
	"api/realtime"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

// Each join sends Presence to everyone, so the cost grows with the square of
// this number. It is far above what a side project expects.
const maxVisitors = 200

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     checkOrigin,
}

type config struct {
	Addr           string
	AllowedOrigins map[string]struct{}
}

var allowedOrigins map[string]struct{}

func main() {
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
	mux.HandleFunc("/connect", websocketHandler(hub, maxVisitors))

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	fmt.Println("Go API listening on", cfg.Addr)
	log.Fatal(server.ListenAndServe())
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
		if origin, ok := normalizeOrigin(origin); ok {
			origins[origin] = struct{}{}
		}
	}

	return origins
}

func checkOrigin(r *http.Request) bool {
	origin, ok := normalizeOrigin(r.Header.Get("Origin"))
	if !ok {
		return false
	}

	if _, ok := allowedOrigins[origin]; ok {
		return true
	}

	log.Printf("Rejected WebSocket origin %q; add it to ALLOWED_ORIGINS to allow this client", origin)
	return false
}

func normalizeOrigin(value string) (string, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", false
	}

	u, err := url.Parse(value)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "", false
	}

	if u.Scheme != "http" && u.Scheme != "https" {
		return "", false
	}

	return u.Scheme + "://" + u.Host, true
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]string{"status": "ok"}); err != nil {
		log.Printf("Error encoding health response: %v", err)
	}
}

func websocketHandler(hub *realtime.Hub, maxVisitors int64) http.HandlerFunc {
	var visitors atomic.Int64

	return func(w http.ResponseWriter, r *http.Request) {
		if visitors.Add(1) > maxVisitors {
			visitors.Add(-1)
			http.Error(w, "Too many Visitors, try again soon", http.StatusServiceUnavailable)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			visitors.Add(-1)
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		client := realtime.NewClient(hub, conn)
		hub.Register(client)

		go client.WritePump()
		go func() {
			client.ReadPump()
			visitors.Add(-1)
		}()
	}
}
