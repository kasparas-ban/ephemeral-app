package realtime

type TypingUpdateMessage struct {
	Type   string `json:"type"` // "typing_update"
	UserID string `json:"userId"`
	Char   string `json:"char"`
}

type TypingClearMessage struct {
	Type   string `json:"type"` // "typing_clear"
	UserID string `json:"userId"`
}

type PresenceUser struct {
	ID string `json:"id"`
}

type PresenceMessage struct {
	Type  string         `json:"type"` // "presence"
	Users []PresenceUser `json:"users"`
}
