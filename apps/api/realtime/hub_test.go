package realtime

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func newTestClient(h *Hub, id string, buffer int) *Client {
	if buffer <= 0 {
		buffer = 10
	}

	return &Client{
		userID: id,
		hub:    h,
		conn:   nil,
		send:   make(chan []byte, buffer),
	}
}

func drainChannel(ch <-chan []byte) {
	for {
		if readWithTimeout(ch, 20*time.Millisecond) == nil {
			return
		}
	}
}

func TestHub_RegisterBroadcastsPresenceToExistingClients(t *testing.T) {
	h := NewHub()
	go h.Run()

	first := newTestClient(h, "user-1", 10)
	second := newTestClient(h, "user-2", 10)

	h.Register(first)
	// First registration should receive an empty presence list
	if raw := readWithTimeout(first.send, 200*time.Millisecond); raw == nil {
		t.Fatalf("expected presence message for first registration, got none")
	} else {
		var presence PresenceMessage
		if err := json.Unmarshal(raw, &presence); err != nil {
			t.Fatalf("unmarshal presence for first: %v", err)
		}
		if presence.Type != "presence" {
			t.Fatalf("expected presence type, got %q", presence.Type)
		}
		if len(presence.Users) != 0 {
			t.Fatalf("expected empty presence for first registration, got %+v", presence.Users)
		}
	}

	h.Register(second)

	raw := readWithTimeout(first.send, 200*time.Millisecond)
	if raw == nil {
		t.Fatalf("expected presence message after second registration, got none")
	}

	var presence PresenceMessage
	if err := json.Unmarshal(raw, &presence); err != nil {
		t.Fatalf("unmarshal presence: %v", err)
	}

	if presence.Type != "presence" {
		t.Fatalf("expected presence type, got %q", presence.Type)
	}

	if len(presence.Users) != 1 || presence.Users[0].ID != second.userID {
		t.Fatalf("expected presence with only second user for first client, got %+v", presence.Users)
	}

	// Newly registered client should receive presence with only the first user
	if raw := readWithTimeout(second.send, 200*time.Millisecond); raw == nil {
		t.Fatalf("expected presence message for newly registered client, got none")
	} else {
		var presence2 PresenceMessage
		if err := json.Unmarshal(raw, &presence2); err != nil {
			t.Fatalf("unmarshal presence for second: %v", err)
		}
		if presence2.Type != "presence" {
			t.Fatalf("expected presence type, got %q", presence2.Type)
		}
		if len(presence2.Users) != 1 || presence2.Users[0].ID != first.userID {
			t.Fatalf("expected presence with only first user for newly registered client, got %+v", presence2.Users)
		}
	}
}

func TestHub_UnregisterClosesChannelAndBroadcastsPresence(t *testing.T) {
	h := NewHub()
	go h.Run()

	first := newTestClient(h, "user-1", 10)
	second := newTestClient(h, "user-2", 10)

	h.Register(first)
	h.Register(second)

	// Drain presence messages produced by registering the second client (to first) and the presence sent to the newly registered client.
	drainChannel(first.send)
	drainChannel(second.send)

	h.unregister <- second

	raw := readWithTimeout(first.send, 200*time.Millisecond)
	if raw == nil {
		t.Fatalf("expected presence update after unregister, got none")
	}

	var presence PresenceMessage
	if err := json.Unmarshal(raw, &presence); err != nil {
		t.Fatalf("unmarshal presence: %v", err)
	}

	if len(presence.Users) != 0 {
		t.Fatalf("expected empty presence after only one client remains, got %+v", presence.Users)
	}

	select {
	case _, ok := <-second.send:
		if ok {
			t.Fatalf("expected send channel for unregistered client to be closed")
		}
	case <-time.After(200 * time.Millisecond):
		t.Fatalf("timed out waiting for unregistered client's channel to close")
	}
}

func TestHub_BroadcastMessageExceptSendsToOtherClients(t *testing.T) {
	h := NewHub()
	go h.Run()

	sender := newTestClient(h, "sender", 10)
	receiverA := newTestClient(h, "receiver-a", 10)
	receiverB := newTestClient(h, "receiver-b", 10)

	h.Register(sender)
	h.Register(receiverA)
	h.Register(receiverB)

	// Drain presence messages caused by registrations.
	drainChannel(sender.send)
	drainChannel(receiverA.send)
	drainChannel(receiverB.send)

	payload := struct {
		Type string `json:"type"`
		Body string `json:"body"`
	}{
		Type: "custom",
		Body: "hello",
	}

	h.BroadcastMessageExcept(sender, payload)

	for _, client := range []*Client{receiverA, receiverB} {
		raw := readWithTimeout(client.send, 200*time.Millisecond)
		if raw == nil {
			t.Fatalf("expected broadcast message for %s, got none", client.userID)
		}

		var msg struct {
			Type string `json:"type"`
			Body string `json:"body"`
			User string `json:"user"`
		}
		if err := json.Unmarshal(raw, &msg); err != nil {
			t.Fatalf("unmarshal broadcast for %s: %v", client.userID, err)
		}

		if msg.Type != "custom" || msg.Body != "hello" {
			t.Fatalf("unexpected broadcast payload for %s: %+v", client.userID, msg)
		}
	}

	if raw := readWithTimeout(sender.send, 150*time.Millisecond); raw != nil {
		t.Fatalf("expected sender to be excluded from broadcast, got %s", string(raw))
	}
}

func TestHub_BroadcastMessageExceptSkipsOnMarshalError(t *testing.T) {
	h := NewHub()
	go h.Run()

	sender := newTestClient(h, "sender", 10)
	receiver := newTestClient(h, "receiver", 10)

	h.Register(sender)
	h.Register(receiver)

	// Drain presence messages caused by registering receiver (to sender) and presence to the newly registered receiver.
	drainChannel(sender.send)
	drainChannel(receiver.send)

	// json cannot marshal a channel, which should trigger the error path.
	msg := map[string]any{
		"type":    "broken",
		"payload": make(chan int),
	}

	h.BroadcastMessageExcept(sender, msg)

	if raw := readWithTimeout(receiver.send, 150*time.Millisecond); raw != nil {
		t.Fatalf("expected no broadcast after marshal error, got %s", string(raw))
	}
}

func TestHub_UnregisterUnknownClientDoesNothing(t *testing.T) {
	h := NewHub()
	go h.Run()

	existing := newTestClient(h, "existing", 10)
	h.Register(existing)
	drainChannel(existing.send)

	ghost := newTestClient(h, "ghost", 10)

	h.unregister <- ghost

	// Give the hub time to process the unregister request.
	time.Sleep(20 * time.Millisecond)

	select {
	case _, ok := <-ghost.send:
		if !ok {
			t.Fatalf("expected send channel for unknown client to remain open")
		}
	default:
	}

	if raw := readWithTimeout(existing.send, 100*time.Millisecond); raw != nil {
		t.Fatalf("expected no presence update when unregistering unknown client, got %s", string(raw))
	}
}

// expectDisconnected drains whatever the client already had queued and checks
// that the hub then closed its send channel.
func expectDisconnected(t *testing.T, c *Client) {
	t.Helper()

	timeout := time.After(500 * time.Millisecond)
	for {
		select {
		case _, ok := <-c.send:
			if !ok {
				return
			}
		case <-timeout:
			t.Fatalf("expected %s to be disconnected", c.userID)
		}
	}
}

// lastPresence returns the users in the last presence message sent to c.
func lastPresence(t *testing.T, c *Client) []PresenceUser {
	t.Helper()

	var users []PresenceUser
	found := false
	for raw := readWithTimeout(c.send, 100*time.Millisecond); raw != nil; raw = readWithTimeout(c.send, 100*time.Millisecond) {
		var presence PresenceMessage
		if err := json.Unmarshal(raw, &presence); err == nil && presence.Type == "presence" {
			users = presence.Users
			found = true
		}
	}

	if !found {
		t.Fatalf("expected a presence message for %s", c.userID)
	}
	return users
}

func TestHub_BroadcastDisconnectsClientsThatFallBehind(t *testing.T) {
	h := NewHub()
	go h.Run()

	sender := newTestClient(h, "sender", 10)
	slow := newTestClient(h, "slow", 1)
	open := newTestClient(h, "open", 10)
	h.Register(sender)
	h.Register(open)
	h.Register(slow)
	drainChannel(sender.send)
	drainChannel(open.send)
	drainChannel(slow.send)

	slow.send <- []byte("unread")
	h.BroadcastMessageExcept(sender, RelayMessage{Type: "typing_update", Char: "a"})

	// Check the open client first: reading the slow client's queue early would
	// make room in its buffer before the hub tries to send.
	raw := readWithTimeout(open.send, 200*time.Millisecond)
	if raw == nil || !strings.Contains(string(raw), "typing_update") {
		t.Fatalf("expected the broadcast for the open client, got %q", raw)
	}
	if users := lastPresence(t, open); len(users) != 1 || users[0].ID != sender.userID {
		t.Fatalf("expected presence without the slow client, got %+v", users)
	}
	expectDisconnected(t, slow)
}

func TestHub_PresenceDisconnectsClientsThatFallBehind(t *testing.T) {
	h := NewHub()
	go h.Run()

	slow := newTestClient(h, "slow", 1)
	h.Register(slow)
	drainChannel(slow.send)
	slow.send <- []byte("unread")

	joining := newTestClient(h, "joining", 10)
	h.Register(joining)

	if users := lastPresence(t, joining); len(users) != 0 {
		t.Fatalf("expected the joining client to end up alone, got %+v", users)
	}
	expectDisconnected(t, slow)
}
