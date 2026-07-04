import { notFound } from "next/navigation";

export default async function DevSimulatorPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const { default: DevSimulator } = await import(
    "@/components/dev/dev-simulator"
  );

  return <DevSimulator />;
}
