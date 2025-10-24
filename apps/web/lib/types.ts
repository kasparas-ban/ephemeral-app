export type ServerEnvelope<T = unknown> = {
  type: string;
  data: T;
};

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

export type ClientEnvelope<T = unknown> = {
  type: string;
  data: T;
};
