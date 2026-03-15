export type Presence = {
  users: { id: string }[];
};

export type TypingUpdate = {
  userId: string;
  char: string;
};

export type TypingClear = {
  userId: string;
};

export type TypingBack = {
  userId: string;
};

// Server -> Client messages (flat, include userId when applicable)
export type ServerMessage =
  | ({ type: "presence" } & Presence)
  | ({ type: "typing_update" } & TypingUpdate)
  | ({ type: "typing_clear" } & TypingClear)
  | ({ type: "typing_back" } & TypingBack);

// Client -> Server messages (flat, no userId)
export type ClientTypingUpdate = {
  type: "typing_update";
  // May be omitted for non-character updates (e.g., delete/enter)
  char?: string;
};

export type ClientTypingClear = {
  type: "typing_clear";
};

export type ClientTypingBack = {
  type: "typing_back";
};

export type ClientMessage =
  | ClientTypingUpdate
  | ClientTypingClear
  | ClientTypingBack;
