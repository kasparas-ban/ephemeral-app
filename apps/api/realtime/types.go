package realtime

type RelayMessage struct {
	Type   string `json:"type"`
	UserID string `json:"userId"`
	Char   string `json:"char,omitempty"`
}

type PresenceUser struct {
	ID string `json:"id"`
}

type PresenceMessage struct {
	Type  string         `json:"type"` // "presence"
	Users []PresenceUser `json:"users"`
}
