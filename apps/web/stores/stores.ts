import { atom, createStore } from "jotai";
import { Presence } from "@/lib/types";
import { WSClient } from "@/lib/ws";

const store = createStore();
const connectedUsersAtom = atom<Presence["users"]>([]);

export const getConnectedUsers = () => store.get(connectedUsersAtom);
export const setConnectedUsers = (users: Presence["users"]) =>
  store.set(connectedUsersAtom, users);

export const wsClientAtom = atom<WSClient | null>(null);
