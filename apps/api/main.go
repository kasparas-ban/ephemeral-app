package main

import (
	"api/realtime"
	"fmt"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:    1024,
	WriteBufferSize:   1024,
	EnableCompression: true,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	hub := realtime.NewHub()
	go hub.Run()

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		userID := uuid.New().String()
		client := realtime.NewClient(hub, conn, userID)
		hub.Register(client)

		go client.WritePump()
		go client.ReadPump()
	})

	addr := ":8080"
	fmt.Println("Go API listening on", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
