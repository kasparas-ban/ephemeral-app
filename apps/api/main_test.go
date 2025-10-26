package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"api/realtime"

	"github.com/gorilla/websocket"
)

func TestHealthHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	healthHandler().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d", rr.Code)
	}

	if rr.Header().Get("Content-Type") != "application/json" {
		t.Fatalf("expected content-type application/json, got %s", rr.Header().Get("Content-Type"))
	}

	var body map[string]string
	if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}

	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %q", body["status"])
	}
}

func TestIntegration_WebsocketTypingFlow(t *testing.T) {
	t.Setenv("ALLOWED_ORIGINS", "http://example.com")

	h := realtime.NewHub()
	go h.Run()

	mux := http.NewServeMux()
	mux.Handle("/connect", websocketHandler(h))

	srv := httptest.NewServer(mux)
	defer srv.Close()

	wsURL := "ws" + strings.TrimPrefix(srv.URL, "http") + "/connect"
	headers := http.Header{}
	headers.Set("Origin", "http://example.com")

	connA, _, err := websocket.DefaultDialer.Dial(wsURL, headers)
	if err != nil {
		t.Fatalf("dial first client: %v", err)
	}
	defer connA.Close()

	connB, _, err := websocket.DefaultDialer.Dial(wsURL, headers)
	if err != nil {
		t.Fatalf("dial second client: %v", err)
	}
	defer connB.Close()

	// Newly connected client should receive a presence message with existing users; drain it before proceeding.
	connB.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	if mt, raw, err := connB.ReadMessage(); err == nil {
		if mt != websocket.TextMessage {
			t.Fatalf("expected text message for presence, got %d", mt)
		}
		var presenceB realtime.PresenceMessage
		if err := json.Unmarshal(raw, &presenceB); err != nil {
			t.Fatalf("unmarshal presence for connB: %v", err)
		}
		if presenceB.Type != "presence" {
			t.Fatalf("expected presence type for connB, got %q", presenceB.Type)
		}
	}
	connB.SetReadDeadline(time.Time{})

	connA.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	msgType, raw, err := connA.ReadMessage()
	if err != nil {
		t.Fatalf("read presence: %v", err)
	}
	if msgType != websocket.TextMessage {
		t.Fatalf("expected text message, got %d", msgType)
	}

	var presence realtime.PresenceMessage
	if err := json.Unmarshal(raw, &presence); err != nil {
		t.Fatalf("unmarshal presence: %v", err)
	}

	if presence.Type != "presence" {
		t.Fatalf("expected presence type, got %q", presence.Type)
	}
	if len(presence.Users) != 2 {
		t.Fatalf("expected 2 users in presence, got %d", len(presence.Users))
	}

	connA.SetReadDeadline(time.Time{})

	if err := connA.WriteJSON(map[string]any{"type": "typing_update", "char": "g"}); err != nil {
		t.Fatalf("write typing update: %v", err)
	}

	connB.SetReadDeadline(time.Now().Add(500 * time.Millisecond))
	msgType, raw, err = connB.ReadMessage()
	if err != nil {
		t.Fatalf("read typing update: %v", err)
	}
	if msgType != websocket.TextMessage {
		t.Fatalf("expected text message, got %d", msgType)
	}

	var typing realtime.TypingUpdateMessage
	if err := json.Unmarshal(raw, &typing); err != nil {
		t.Fatalf("unmarshal typing update: %v", err)
	}

	if typing.Type != "typing_update" {
		t.Fatalf("expected typing_update type, got %q", typing.Type)
	}
	if typing.Char != "g" {
		t.Fatalf("expected char 'g', got %q", typing.Char)
	}
	if typing.UserID == "" {
		t.Fatalf("expected user ID in typing update")
	}
}
