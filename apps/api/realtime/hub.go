package realtime

import (
	"encoding/json"
	"log"
)

type broadcastRequest struct {
	data    []byte
	exclude *Client
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan broadcastRequest
	register   chan *Client
	unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan broadcastRequest, 256),
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
			h.clients[client] = true
			log.Printf("Client registered: %s (total: %d)", client.userID, len(h.clients))
			h.broadcastPresence()

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("Client unregistered: %s (total: %d)", client.userID, len(h.clients))
				h.broadcastPresence()
			}

		case req := <-h.broadcast:
			for client := range h.clients {
				if client != req.exclude {
					h.trySend(client, req.data)
				}
			}
		}
	}
}

// broadcastPresence sends every connected client the presence list of all other
// connected clients. Each client is excluded from its own list because clients
// don't know their own server-assigned ID and rely on the server to filter it out.
func (h *Hub) broadcastPresence() {
	for target := range h.clients {
		users := make([]PresenceUser, 0, len(h.clients))
		for c := range h.clients {
			if c != target {
				users = append(users, PresenceUser{ID: c.userID})
			}
		}

		data, err := json.Marshal(PresenceMessage{Type: "presence", Users: users})
		if err != nil {
			log.Printf("Error marshaling presence for client %s: %v", target.userID, err)
			continue
		}

		h.trySend(target, data)
	}
}

// trySend delivers data to the client's send buffer, dropping the message if the
// buffer is full so a slow client can't block the hub.
func (h *Hub) trySend(c *Client, data []byte) {
	select {
	case c.send <- data:
	default:
		log.Printf("Client %s send buffer full, skipping message", c.userID)
	}
}

func (h *Hub) BroadcastMessageExcept(sender *Client, msg any) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}

	h.broadcast <- broadcastRequest{data: data, exclude: sender}
}
