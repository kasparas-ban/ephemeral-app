"use client";

import { atom, useAtomValue } from "jotai";
import { connectedUsersAtom, wsClientAtom } from "@/stores/stores";
import WorldCanvas from "@/components/canvas/WorldCanvas";
import Ephemeral from "@/components/ephemeral/ephemeral";
import { useMemo } from "react";
import IncommingEphemeralComponent from "@/components/ephemeral/incomming-ephemeral";

export default function Home() {
  return (
    <div className="font-sans">
      <main className="flex items-center justify-center h-screen p-4">
        <div className="absolute inset-0">
          <WorldCanvas>
            <IncomingEphemerals />
          </WorldCanvas>
        </div>

        <UserEphemeral />
      </main>
    </div>
  );
}

function IncomingEphemerals() {
  const connectedUsers = useAtomValue(connectedUsersAtom);

  console.log("Connected users:", connectedUsers);

  return (
    <>
      {connectedUsers.map((user) => (
        <div
          key={user.id}
          className="h-20 w-20 bg-red-500"
          style={{
            translate: `${100 * Math.random()}px ${100 * Math.random()}px`,
          }}
        >
          <IncomingEphemeralItem userId={user.id} />
        </div>
      ))}
    </>
  );
}

function IncomingEphemeralItem({ userId }: { userId: string }) {
  const textAtom = useMemo(() => atom(""), []);
  return <IncommingEphemeralComponent textAtom={textAtom} userId={userId} />;
}

function UserEphemeral() {
  const wsClient = useAtomValue(wsClientAtom);
  return <Ephemeral handlers={{ onInput: wsClient?.send }} />;
}
