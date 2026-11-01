"use client";

import { useEffect } from "react";

import { useSetAtom } from "jotai";

import { WSClient } from "@/lib/ws";
import { connectedUsersAtom, wsClientAtom } from "@/stores/stores";

export const ConnectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const setWsClient = useSetAtom(wsClientAtom);
  const setConnectedUsers = useSetAtom(connectedUsersAtom);

  useEffect(() => {
    const ws = new WSClient();

    const unsubscribeMessage = ws.onMessage((msg) => {
      if (msg.type === "presence") setConnectedUsers(msg.users);
    });
    // Without a connection, nobody else is here; a reconnect brings fresh Presence.
    const unsubscribeStatus = ws.onStatus((status) => {
      if (status !== "open") setConnectedUsers([]);
    });

    ws.connect();
    setWsClient(ws);

    return () => {
      unsubscribeMessage();
      unsubscribeStatus();
      ws.disconnect();
      setWsClient(null);
    };
  }, [setWsClient, setConnectedUsers]);

  return children;
};
