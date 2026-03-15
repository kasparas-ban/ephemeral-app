import { atom, getDefaultStore } from "jotai";
import { Presence } from "@/lib/types";
import { WSClient } from "@/lib/ws";

const store = getDefaultStore();
export const connectedUsersAtom = atom<Presence["users"]>([]);
export const setConnectedUsers = (users: Presence["users"]) =>
  store.set(connectedUsersAtom, users);

export const wsClientAtom = atom<WSClient | null>(null);
