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
			// Send current presence (excluding the newly registered client) to the newly registered client
			h.sendPresenceTo(client)

			// Broadcast updated presence to all existing clients except the new one
			h.broadcastPresenceExcept(client)

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("Client unregistered: %s (total: %d)", client.userID, len(h.clients))

				h.broadcastPresenceExcept(client)
			}

		case req := <-h.broadcast:
			for client := range h.clients {
				if client == req.exclude {
					continue
				}
				select {
				case client.send <- req.data:
				default:
					log.Printf("Client %s send buffer full, skipping message", client.userID)
				}
			}
		}
	}
}

func (h *Hub) broadcastPresenceExcept(exclude *Client) {
	// For each target client (except the excluded one), build a presence list
	// that contains all other clients except the target itself. This ensures
	// no client sees itself in the presence list.
	for target := range h.clients {
		if target == exclude {
			continue
		}

		users := make([]PresenceUser, 0, len(h.clients))
		for c := range h.clients {
			if c == target {
				continue
			}
			users = append(users, PresenceUser{ID: c.userID})
		}

		presence := PresenceMessage{
			Type:  "presence",
			Users: users,
		}

		data, err := json.Marshal(presence)
		if err != nil {
			log.Printf("Error marshaling presence: %v", err)
			continue
		}

		select {
		case target.send <- data:
		default:
			log.Printf("Client %s send buffer full, skipping message", target.userID)
		}
	}
}

// sendPresenceTo sends the presence list of all other connected clients to the specified client.
func (h *Hub) sendPresenceTo(target *Client) {
	users := make([]PresenceUser, 0, len(h.clients))
	for client := range h.clients {
		if client == target {
			continue
		}
		users = append(users, PresenceUser{ID: client.userID})
	}

	presence := PresenceMessage{
		Type:  "presence",
		Users: users,
	}

	data, err := json.Marshal(presence)
	if err != nil {
		log.Printf("Error marshaling presence for client %s: %v", target.userID, err)
		return
	}

	select {
	case target.send <- data:
	default:
		log.Printf("Client %s send buffer full, skipping presence", target.userID)
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
