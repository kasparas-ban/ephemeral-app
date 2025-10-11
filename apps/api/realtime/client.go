package realtime

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 20 * time.Second
	maxMessageSize = 8192
)

type Client struct {
	userID string
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
}

func NewClient(hub *Hub, conn *websocket.Conn, userID string) *Client {
	return &Client{
		userID: userID,
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, 256),
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
	var baseMsg struct {
		Type string `json:"type"`
	}

	if err := json.Unmarshal(data, &baseMsg); err != nil {
		log.Printf("Error unmarshaling message from %s: %v", c.userID, err)
		return
	}

	switch baseMsg.Type {
	case "hello":
		c.handleHello()

	case "typing_start":
		var msg TypingStartMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			log.Printf("Error parsing typing_start: %v", err)
			return
		}
		c.handleTypingStart(msg)

	case "typing_update":
		var msg TypingUpdateMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			log.Printf("Error parsing typing_update: %v", err)
			return
		}
		c.handleTypingUpdate(msg)

	case "typing_end":
		var msg TypingEndMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			log.Printf("Error parsing typing_end: %v", err)
			return
		}
		c.handleTypingEnd(msg)

	default:
		log.Printf("Unknown message type from %s: %s", c.userID, baseMsg.Type)
	}
}

func (c *Client) handleHello() {
	response := HelloAckMessage{
		Type:   "hello_ack",
		UserID: c.userID,
	}

	data, err := json.Marshal(response)
	if err != nil {
		log.Printf("Error marshaling hello_ack: %v", err)
		return
	}

	select {
	case c.send <- data:
	default:
		log.Printf("Client %s send buffer full for hello_ack", c.userID)
	}
}

func (c *Client) handleTypingStart(msg TypingStartMessage) {
	broadcast := TypingStateMessage{
		Type:          "typing_state",
		FromUserID:    c.userID,
		CompositionID: msg.CompositionID,
		Seq:           0,
		Text:          "",
		Ts:            nowMs(),
	}
	c.hub.BroadcastMessage(broadcast)
}

func (c *Client) handleTypingUpdate(msg TypingUpdateMessage) {
	if len(msg.Text) > MaxCompositionLength {
		log.Printf("Text too long from %s: %d chars", c.userID, len(msg.Text))
		return
	}

	broadcast := TypingStateMessage{
		Type:          "typing_state",
		FromUserID:    c.userID,
		CompositionID: msg.CompositionID,
		Seq:           msg.Seq,
		Text:          msg.Text,
		Ts:            nowMs(),
	}
	c.hub.BroadcastMessage(broadcast)
}

func (c *Client) handleTypingEnd(msg TypingEndMessage) {
	broadcast := TypingEndBroadcast{
		Type:          "typing_end",
		FromUserID:    c.userID,
		CompositionID: msg.CompositionID,
		FinalText:     msg.FinalText,
		Ts:            nowMs(),
		TTLMs:         msg.TTLMs,
	}
	c.hub.BroadcastMessage(broadcast)
}
