export type ServerEnvelope<T = unknown> = {
  type: string;
  data: T;
};

export type Presence = {
  users: { id: string }[];
};

export type TypingState = {
  fromUserId: string;
  compositionId: string;
  text: string;
  ts: number;
};

export type TypingEnd = {
  fromUserId: string;
  compositionId: string;
  finalText?: string;
  ts: number;
  ttlMs?: number;
};

export type ClientEnvelope<T = unknown> = {
  type: string;
  data: T;
};

export type TypingUpdateMsg = {
  compositionId: string;
  text: string;
};
export type TypingEndMsg = {
  compositionId: string;
  finalText?: string;
  ttlMs?: number;
};
