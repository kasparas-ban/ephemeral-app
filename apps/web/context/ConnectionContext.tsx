import { Presence, TypingEnd, TypingState } from "@/lib/types";
import { WSClient } from "@/lib/ws_old";
import { createContext, useContext, useEffect, useState } from "react";

type ConnectionState = {
  wsClient: WSClient | null;
};

const ConnectionContext = createContext<ConnectionState | null>(null);

export const ConnectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [wsClient, setWsClient] = useState<WSClient | null>(null);

  useEffect(() => {
    const ws = new WSClient({
      presence: (_: Presence) => {},
      typingState: (m: TypingState) =>
        (globalThis as any).__worldCanvas?.applyTypingState(m),
      typingEnd: (m: TypingEnd) =>
        (globalThis as any).__worldCanvas?.applyTypingEnd(m),
    });
  }, []);

  return (
    <ConnectionContext.Provider value={{ wsClient }}>
      {children}
    </ConnectionContext.Provider>
  );
};

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error("useConnection must be used within a ConnectionProvider");
  }
  return context;
};
