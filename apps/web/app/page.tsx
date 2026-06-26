"use client";

import { atom, useAtomValue } from "jotai";
import { connectedUsersAtom } from "@/stores/stores";
import WorldCanvas from "@/components/canvas/WorldCanvas";
import LocalEphemeral from "@/components/ephemeral/local-ephemeral";
import { useMemo } from "react";
import RemoteEphemeral from "@/components/ephemeral/remote-ephemeral";

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
          className="absolute h-20 w-20 bg-red-500"
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
  return <RemoteEphemeral textAtom={textAtom} userId={userId} />;
}

function UserEphemeral() {
  return <LocalEphemeral />;
}
