package realtime

import "time"

// Client -> Server messages

type HelloMessage struct {
	Type string `json:"type"` // "hello"
}

type TypingStartMessage struct {
	Type   string `json:"type"` // "typing_start"
	UserID string `json:"userId"`
}

type TypingUpdateMessage struct {
	Type   string `json:"type"` // "typing_update"
	UserID string `json:"userId"`
	Text   string `json:"text"`
}

type TypingEndMessage struct {
	Type      string  `json:"type"` // "typing_end"
	UserID    string  `json:"userId"`
	FinalText *string `json:"finalText,omitempty"`
	TTLMs     *int    `json:"ttlMs,omitempty"`
}

// Server -> Client messages

type HelloAckMessage struct {
	Type   string `json:"type"` // "hello_ack"
	UserID string `json:"userId"`
}

type PresenceUser struct {
	ID string `json:"id"`
}

type PresenceMessage struct {
	Type  string         `json:"type"` // "presence"
	Users []PresenceUser `json:"users"`
}

type TypingStateMessage struct {
	Type       string `json:"type"` // "typing_state"
	FromUserID string `json:"fromUserId"`
	Text       string `json:"text"`
	Ts         int64  `json:"ts"`
}

type TypingEndBroadcast struct {
	Type       string  `json:"type"` // "typing_end"
	FromUserID string  `json:"fromUserId"`
	FinalText  *string `json:"finalText,omitempty"`
	Ts         int64   `json:"ts"`
	TTLMs      *int    `json:"ttlMs,omitempty"`
}

// Helper function to get current timestamp in milliseconds
func nowMs() int64 {
	return time.Now().UnixMilli()
}
