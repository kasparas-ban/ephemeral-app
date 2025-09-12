import Ephemeral from "@/components/ephemeral/ephemeral";
import EphemeralBlock from "@/components/ephemeral/ephemeral-block-updated";
import EphemeralClass from "@/components/ephemeral/ephemeral-class";
import EphemeralWiggly from "@/components/ephemeral/ephemeral-wiggly";
import WiggleLine from "@/components/ephemeral/wiggly-line";

export default function Home() {
  return (
    <div className="font-sans">
      <main className="flex items-center justify-center h-screen p-4">
        {/* <Ephemeral /> */}
        {/* <WiggleLine /> */}
        {/* <EphemeralWiggly /> */}
        {/* <EphemeralBlock /> */}
        <EphemeralClass />
      </main>
    </div>
  );
}
