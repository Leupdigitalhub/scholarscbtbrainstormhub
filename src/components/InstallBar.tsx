import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIP = Event & { prompt: () => Promise<void> };

export function InstallBar() {
  const [evt, setEvt] = useState<BIP | null>(null);
  const [help, setHelp] = useState(false);
  const [hideTip, setHideTip] = useState(false);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setEvt(e as BIP); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  const install = async () => {
    if (evt) { await evt.prompt(); setEvt(null); } else setHelp(true);
  };
  return (
    <div className="mx-auto max-w-5xl space-y-2 px-5 pt-4">
      {!hideTip && (
        <div className="flex items-start gap-2 rounded-xl border border-warning bg-warning/90 p-3 text-sm font-semibold text-warning-foreground">
          <span>⚠️ If you see “Edit with Lovable” at the bottom of the screen, tap the ✖ cancel button beside it.</span>
          <button aria-label="Close notice" onClick={() => setHideTip(true)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}
      <Button onClick={install} size="lg" className="h-12 w-full bg-success text-success-foreground hover:bg-success/90 sm:w-auto">
        <Download className="mr-2 h-5 w-5" /> Install Scholars CBT App
      </Button>
      {help && (
        <p className="rounded-xl bg-card p-3 text-sm text-card-foreground">
          Android (Chrome): tap the ⋮ menu → <b>Install app</b>. iPhone (Safari): tap Share → <b>Add to Home Screen</b>.
        </p>
      )}
    </div>
  );
}
