import { atom } from "jotai";

import { Presence } from "@/lib/types";
import { WSClient } from "@/lib/ws";

export const connectedUsersAtom = atom<Presence["users"]>([]);

export const wsClientAtom = atom<WSClient | null>(null);
