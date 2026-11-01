package realtime

import (
	"encoding/json"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 90 * time.Second
	pingPeriod     = 30 * time.Second
	maxMessageSize = 512

	// Faster than any typist or key repeat, slow enough that one Visitor
	// can't flood everyone else's screen.
	messagesPerSecond = 50
	messageBurst      = 100
)

type Client struct {
	userID string
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	quota  messageQuota
}

func NewClient(hub *Hub, conn *websocket.Conn) *Client {
	userID := uuid.New().String()

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
	if !c.quota.allow(time.Now()) {
		return
	}

	var msg RelayMessage
	if err := json.Unmarshal(data, &msg); err != nil || !isValidTypingMessage(msg) {
		log.Printf("Dropped invalid message from %s", c.userID)
		return
	}

	msg.UserID = c.userID
	c.hub.BroadcastMessageExcept(c, msg)
}

// isValidTypingMessage mirrors the web client's rules: a typing update carries
// exactly one printable ASCII character, and other typing messages carry none.
func isValidTypingMessage(msg RelayMessage) bool {
	switch msg.Type {
	case "typing_update":
		return len(msg.Char) == 1 && msg.Char[0] >= 0x20 && msg.Char[0] <= 0x7e
	case "typing_back", "typing_clear":
		return msg.Char == ""
	default:
		return false
	}
}

// messageQuota is a token bucket whose zero value starts full.
type messageQuota struct {
	spent float64
	last  time.Time
}

func (q *messageQuota) allow(now time.Time) bool {
	if !q.last.IsZero() {
		q.spent = max(0, q.spent-now.Sub(q.last).Seconds()*messagesPerSecond)
	}
	q.last = now

	if q.spent+1 > messageBurst {
		return false
	}

	q.spent++
	return true
}
