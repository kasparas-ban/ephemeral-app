package realtime

var relayableTypes = map[string]bool{
	"typing_update": true,
	"typing_clear":  true,
	"typing_back":   true,
}

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
