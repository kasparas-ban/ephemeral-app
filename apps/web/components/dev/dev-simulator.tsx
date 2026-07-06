"use client";

import EphemeralApp from "@/components/ephemeral/ephemeral-app";

import DevSimulatorPanel from "./dev-simulator-panel";

export default function DevSimulator() {
  return (
    <>
      <EphemeralApp />
      <DevSimulatorPanel />
    </>
  );
}
