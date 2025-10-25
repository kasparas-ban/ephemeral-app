import WorldCanvas from "@/components/canvas/WorldCanvas";
import Ephemeral from "@/components/ephemeral/ephemeral";

export default function Home() {
  return (
    <div className="font-sans">
      <main className="flex items-center justify-center h-screen p-4">
        <div className="absolute inset-0">
          <WorldCanvas>
            <IncomingEphemerals />
          </WorldCanvas>
        </div>

        <Ephemeral />
      </main>
    </div>
  );
}

function IncomingEphemerals() {
  return (
    <div className="w-20 h-20 bg-red-500 translate-x-[200px] translate-y-[100px]" />
  );
}
