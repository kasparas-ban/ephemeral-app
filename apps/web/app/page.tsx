"use client";

import { useMemo } from "react";
import { atom, useAtomValue } from "jotai";
import { connectedUsersAtom } from "@/stores/stores";
import WorldCanvas from "@/components/canvas/WorldCanvas";
import LocalEphemeral from "@/components/ephemeral/local-ephemeral";
import RemoteEphemeral from "@/components/ephemeral/remote-ephemeral";
import { spatial } from "@/lib/spatial";

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

  return (
    <>
      {connectedUsers.map((user) => {
        const { x, y } = spatial.getOrAssignPosition(user.id);
        return (
          <div
            key={user.id}
            className="absolute"
            style={{ translate: `${x}px ${y}px` }}
          >
            <IncomingEphemeralItem userId={user.id} />
          </div>
        );
      })}
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
