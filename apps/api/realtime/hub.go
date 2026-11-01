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
				h.disconnect([]*Client{client})
			}

		case req := <-h.broadcast:
			var slow []*Client
			for client := range h.clients {
				if client != req.exclude && !h.trySend(client, req.data) {
					slow = append(slow, client)
				}
			}
			h.disconnect(slow)
		}
	}
}

// disconnect removes clients and tells everyone else. Closing a client's send
// channel makes its WritePump close the connection.
func (h *Hub) disconnect(clients []*Client) {
	if len(clients) == 0 {
		return
	}

	for _, client := range clients {
		delete(h.clients, client)
		close(client.send)
		log.Printf("Client unregistered: %s (total: %d)", client.userID, len(h.clients))
	}

	h.broadcastPresence()
}

// broadcastPresence sends every connected client the presence list of all other
// connected clients. Each client is excluded from its own list because clients
// don't know their own server-assigned ID and rely on the server to filter it out.
func (h *Hub) broadcastPresence() {
	var slow []*Client
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

		if !h.trySend(target, data) {
			slow = append(slow, target)
		}
	}

	h.disconnect(slow)
}

// trySend delivers data to the client's send buffer without blocking the hub.
// A full buffer means the client can't keep up; it should be disconnected
// rather than silently miss messages and drift out of sync.
func (h *Hub) trySend(c *Client, data []byte) bool {
	select {
	case c.send <- data:
		return true
	default:
		log.Printf("Client %s send buffer full, disconnecting", c.userID)
		return false
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
