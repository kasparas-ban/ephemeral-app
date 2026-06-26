package realtime

import (
	"encoding/json"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	writeWait      = 60 * time.Second
	pongWait       = 90 * time.Second
	pingPeriod     = 30 * time.Second
	maxMessageSize = 8192
)

type Client struct {
	userID string
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
}

func NewClient(hub *Hub, conn *websocket.Conn) *Client {
	userID := uuid.New().String()

	return &Client{
		userID: userID,
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, 32),
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})
	c.conn.SetReadLimit(maxMessageSize)

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error for client %s: %v", c.userID, err)
			}
			break
		}

		c.handleMessage(message)
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(data []byte) {
	var envelope map[string]json.RawMessage
	if err := json.Unmarshal(data, &envelope); err != nil {
		log.Printf("Error unmarshaling message from %s: %v", c.userID, err)
		return
	}

	msgType := envelopeType(envelope)
	if !relayableTypes[msgType] {
		log.Printf("Unknown or non-relayable message type from %s: %q", c.userID, msgType)
		return
	}

	c.relay(envelope)
}

func (c *Client) relay(envelope map[string]json.RawMessage) {
	userID, err := json.Marshal(c.userID)
	if err != nil {
		log.Printf("Error marshaling userId for %s: %v", c.userID, err)
		return
	}

	envelope["userId"] = userID
	c.hub.BroadcastMessageExcept(c, envelope)
}

func envelopeType(envelope map[string]json.RawMessage) string {
	raw, ok := envelope["type"]
	if !ok {
		return ""
	}

	var t string
	if err := json.Unmarshal(raw, &t); err != nil {
		return ""
	}

	return t
}
