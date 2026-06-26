import { atom } from "jotai";
import { Presence } from "@/lib/types";
import { ConnectionStatus, WSClient } from "@/lib/ws";

export const connectedUsersAtom = atom<Presence["users"]>([]);
export const connectionStatusAtom = atom<ConnectionStatus>("closed");

export const wsClientAtom = atom<WSClient | null>(null);
