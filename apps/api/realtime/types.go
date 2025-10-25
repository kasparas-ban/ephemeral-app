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

type TypingBackMessage struct {
	Type   string `json:"type"` // "typing_back"
	UserID string `json:"userId"`
}

type TypingUpdateIn struct {
	Type string `json:"type"` // "typing_update"
	Char string `json:"char"`
}

type TypingClearIn struct {
	Type string `json:"type"` // "typing_clear"
}

type TypingBackIn struct {
	Type string `json:"type"` // "typing_back"
}

type PresenceUser struct {
	ID string `json:"id"`
}

type PresenceMessage struct {
	Type  string         `json:"type"` // "presence"
	Users []PresenceUser `json:"users"`
}
