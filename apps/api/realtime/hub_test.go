package realtime

import (
	"encoding/json"
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

func TestHub_PresenceSkipsClientsWithFullBuffer(t *testing.T) {
	h := NewHub()
	go h.Run()

	blocked := newTestClient(h, "blocked", 1)
	other := newTestClient(h, "other", 10)

	h.Register(blocked)

	// Drain the initial presence message sent to the blocked client so we can fill the buffer.
	drainChannel(blocked.send)

	// Fill the blocked client's send buffer so future sends should be skipped.
	blocked.send <- []byte("sentinel")

	h.Register(other)

	// Give the hub time to process the registration and attempted presence broadcast.
	time.Sleep(50 * time.Millisecond)

	select {
	case msg := <-blocked.send:
		if string(msg) != "sentinel" {
			t.Fatalf("expected sentinel message to remain, got %s", string(msg))
		}
	default:
		t.Fatalf("expected blocked client's channel to remain full")
	}

	if raw := readWithTimeout(blocked.send, 100*time.Millisecond); raw != nil {
		t.Fatalf("expected no additional presence message for blocked client, got %s", string(raw))
	}

	// Newly registered client should receive presence containing the blocked client
	if raw := readWithTimeout(other.send, 200*time.Millisecond); raw == nil {
		t.Fatalf("expected presence message for newly registered client, got none")
	} else {
		var presence PresenceMessage
		if err := json.Unmarshal(raw, &presence); err != nil {
			t.Fatalf("unmarshal presence for other: %v", err)
		}
		if presence.Type != "presence" {
			t.Fatalf("expected presence type, got %q", presence.Type)
		}
		if len(presence.Users) != 1 || presence.Users[0].ID != blocked.userID {
			t.Fatalf("expected presence with blocked user for newly registered client, got %+v", presence.Users)
		}
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

func TestHub_BroadcastMessageExceptSkipsFullBuffers(t *testing.T) {
	h := NewHub()
	go h.Run()

	sender := newTestClient(h, "sender", 10)
	blocked := newTestClient(h, "blocked", 1)
	open := newTestClient(h, "open", 10)

	h.Register(sender)
	h.Register(blocked)
	h.Register(open)

	// Drain any presence traffic before assertions.
	drainChannel(sender.send)
	drainChannel(blocked.send)
	drainChannel(open.send)

	blocked.send <- []byte("sentinel")

	payload := map[string]any{
		"type": "custom",
		"body": "hello",
	}

	h.BroadcastMessageExcept(sender, payload)

	if raw := readWithTimeout(open.send, 200*time.Millisecond); raw == nil {
		t.Fatalf("expected broadcast for open client, got none")
	}

	select {
	case msg := <-blocked.send:
		if string(msg) != "sentinel" {
			t.Fatalf("expected sentinel message to remain for blocked client, got %s", string(msg))
		}
	default:
		// If the channel were cleared, the sentinel would have been consumed.
	}

	if raw := readWithTimeout(sender.send, 150*time.Millisecond); raw != nil {
		t.Fatalf("expected sender not to receive broadcast, got %s", string(raw))
	}
}
