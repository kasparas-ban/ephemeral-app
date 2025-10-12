package realtime

import (
	"encoding/json"
	"log"
	"sync"
)

const (
	MaxCompositionLength = 1000
)

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("Client registered: %s (total: %d)", client.userID, len(h.clients))
			h.broadcastPresenceExcept(client)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("Client unregistered: %s (total: %d)", client.userID, len(h.clients))
			}
			h.mu.Unlock()
			h.broadcastPresenceExcept(client)

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					log.Printf("Client %s send buffer full, skipping message", client.userID)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) broadcastPresenceExcept(exclude *Client) {
	h.mu.RLock()
	users := make([]PresenceUser, 0, len(h.clients))
	for client := range h.clients {
		users = append(users, PresenceUser{ID: client.userID})
	}
	h.mu.RUnlock()

	presence := PresenceMessage{
		Type:  "presence",
		Users: users,
	}

	data, err := json.Marshal(presence)
	if err != nil {
		log.Printf("Error marshaling presence: %v", err)
		return
	}

	h.mu.RLock()
	for client := range h.clients {
		if client == exclude {
			continue
		}
		select {
		case client.send <- data:
		default:
			log.Printf("Client %s send buffer full, skipping message", client.userID)
		}
	}
	h.mu.RUnlock()
}

func (h *Hub) BroadcastMessageExcept(sender *Client, msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	h.mu.RLock()
	for client := range h.clients {
		if client == sender {
			continue
		}
		select {
		case client.send <- data:
		default:
			log.Printf("Client %s send buffer full, skipping message", client.userID)
		}
	}
	h.mu.RUnlock()
}
