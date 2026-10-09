import hall from "@/assets/cbt-hall.jpg";

/** Faint exam-hall photo fixed behind portal pages. */
export function HallWatermark() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <img src={hall} alt="" className="h-full w-full object-cover opacity-[0.07] grayscale" />
    </div>
  );
}
