"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { Gauge, MessageSquare, Pause, Play, Users } from "lucide-react";
import {
  DEFAULT_DEV_BOT_PHRASES,
  DEV_BOT_MAX_COUNT,
  DevBotController,
  DevBotSnapshot,
  normalizeDevBotPhrases,
} from "@/lib/dev/dev-bot-controller";
import { connectedUsersAtom } from "@/stores/stores";

const DEFAULT_COUNT = 3;
const DEFAULT_CADENCE_MS = 160;

export default function DevSimulatorPanel() {
  const connectedUsers = useAtomValue(connectedUsersAtom);
  const [botCount, setBotCount] = useState(DEFAULT_COUNT);
  const [cadenceMs, setCadenceMs] = useState(DEFAULT_CADENCE_MS);
  const [phrasesText, setPhrasesText] = useState(
    DEFAULT_DEV_BOT_PHRASES.join("\n"),
  );
  const [running, setRunning] = useState(false);
  const [bots, setBots] = useState<DevBotSnapshot[]>([]);
  const controllerRef = useRef<DevBotController | null>(null);

  const options = useMemo(
    () => ({
      count: botCount,
      cadenceMs,
      phrases: normalizeDevBotPhrases(phrasesText),
    }),
    [botCount, cadenceMs, phrasesText],
  );

  useEffect(() => {
    const controller = new DevBotController(setBots);
    controllerRef.current = controller;

    return () => {
      controller.stop();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    controllerRef.current?.updateOptions(options);
  }, [options, running]);

  useEffect(() => {
    if (!running) return;
    controllerRef.current?.start(options);
  }, [botCount, running]);

  const openBotCount = bots.filter((bot) => bot.status === "open").length;
  const readyToType =
    running &&
    bots.length === botCount &&
    openBotCount === botCount &&
    connectedUsers.length >= botCount;

  useEffect(() => {
    controllerRef.current?.setReadyToType(readyToType);
  }, [readyToType]);

  const start = () => {
    setRunning(true);
  };

  const stop = () => {
    controllerRef.current?.stop();
    setRunning(false);
  };

  return (
    <section
      data-testid="dev-simulator-panel"
      className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] border border-neutral-300 bg-white/95 p-3 text-sm text-neutral-900 shadow-lg backdrop-blur"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold">Dev simulator</h1>
          <p className="text-xs text-neutral-500">
            {openBotCount}/{botCount} bots open, {connectedUsers.length} remote
            users visible
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            title="Start bots"
            data-testid="dev-simulator-start"
            disabled={running}
            onClick={start}
            className="inline-flex h-9 items-center gap-1 border border-neutral-900 px-2 font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play aria-hidden size={16} />
            Start
          </button>
          <button
            type="button"
            title="Stop bots"
            data-testid="dev-simulator-stop"
            disabled={!running}
            onClick={stop}
            className="inline-flex h-9 items-center gap-1 border border-neutral-300 px-2 font-bold disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Pause aria-hidden size={16} />
            Stop
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-xs font-bold">
            <Users aria-hidden size={14} />
            Bots
          </span>
          <input
            data-testid="dev-simulator-bot-count"
            type="number"
            min={1}
            max={DEV_BOT_MAX_COUNT}
            value={botCount}
            onChange={(event) => setBotCount(Number(event.target.value))}
            className="h-9 border border-neutral-300 px-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-xs font-bold">
            <Gauge aria-hidden size={14} />
            Cadence
          </span>
          <input
            data-testid="dev-simulator-cadence"
            type="number"
            min={40}
            max={2_000}
            step={10}
            value={cadenceMs}
            onChange={(event) => setCadenceMs(Number(event.target.value))}
            className="h-9 border border-neutral-300 px-2"
          />
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 text-xs font-bold">
          <MessageSquare aria-hidden size={14} />
          Phrases
        </span>
        <textarea
          data-testid="dev-simulator-phrases"
          value={phrasesText}
          onChange={(event) => setPhrasesText(event.target.value)}
          rows={4}
          className="resize-none border border-neutral-300 p-2 text-xs"
        />
      </label>

      <div
        data-testid="dev-simulator-status"
        className="mt-3 grid max-h-28 gap-1 overflow-auto text-xs"
      >
        {bots.length === 0 ? (
          <p className="text-neutral-500">No bots running</p>
        ) : (
          bots.map((bot) => (
            <div
              key={bot.id}
              className="flex items-center justify-between gap-2 border-t border-neutral-200 pt-1"
            >
              <span>{bot.name}</span>
              <span className="truncate text-neutral-500">
                {bot.phrase || bot.status}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
