"use client";

import { useEffect } from "react";
import { WSClient } from "@/lib/ws";
import { useSetAtom } from "jotai";
import { wsClientAtom } from "@/stores/stores";

export const ConnectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const setWsClient = useSetAtom(wsClientAtom);

  useEffect(() => {
    const ws = new WSClient();
    ws.connect();

    setWsClient(ws);
  }, []);

  return children;
};
