export type ServerEnvelope<T = unknown> = {
  type: string;
  data: T;
};

export type HelloAck = {
  userId: string;
};

export type Presence = {
  users: { id: string }[];
};

export type TypingState = {
  fromUserId: string;
  compositionId: string;
  seq: number;
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

export type TypingStartMsg = { compositionId: string };
export type TypingUpdateMsg = {
  compositionId: string;
  seq: number;
  text: string;
};
export type TypingEndMsg = {
  compositionId: string;
  finalText?: string;
  ttlMs?: number;
};
