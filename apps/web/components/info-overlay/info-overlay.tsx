import "./info-overlay.css";

export default function InfoOverlay() {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-info-title"
      className="infoOverlay absolute inset-0 z-30 grid place-items-center bg-white/45 px-6 text-neutral-950"
    >
      <section className="infoOverlayContent max-w-[min(34rem,calc(100vw-3rem))] text-center">
        <h1
          id="app-info-title"
          className="text-2xl leading-tight font-semibold sm:text-3xl"
        >
          Ephemeral is a shared typing canvas.
        </h1>
        <p className="mt-4 text-sm leading-6 text-neutral-700 sm:text-base sm:leading-7">
          Type and your words appear live in the space for everyone connected.
          Other people&apos;s thoughts drift in as anonymous, temporary text,
          then fade away so the room stays light, present, and unrecorded.
        </p>
      </section>
    </div>
  );
}
