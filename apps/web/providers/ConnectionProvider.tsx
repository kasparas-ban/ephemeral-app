"use client";

import { useEffect } from "react";

import { useSetAtom } from "jotai";

import { WSClient } from "@/lib/ws";
import {
  connectedUsersAtom,
  connectionStatusAtom,
  wsClientAtom,
} from "@/stores/stores";

export const ConnectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const setWsClient = useSetAtom(wsClientAtom);
  const setConnectedUsers = useSetAtom(connectedUsersAtom);
  const setStatus = useSetAtom(connectionStatusAtom);

  useEffect(() => {
    const ws = new WSClient();

    const unsubscribeMessage = ws.onMessage((msg) => {
      if (msg.type === "presence") setConnectedUsers(msg.users);
    });
    const unsubscribeStatus = ws.onStatus(setStatus);

    ws.connect();
    setWsClient(ws);

    return () => {
      unsubscribeMessage();
      unsubscribeStatus();
      ws.disconnect();
      setWsClient(null);
    };
  }, [setWsClient, setConnectedUsers, setStatus]);

  return children;
};
