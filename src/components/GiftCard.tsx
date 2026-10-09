import { useEffect, useState } from "react";
import { Gift, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_MSG = "Take a deep breath and smile — you've prepared for this! Read each question carefully, keep your white sheet and pencil in camera view, and do your best. We believe in you! 🌟";

export function GiftCard({ attemptId, children }: { attemptId: string; children: React.ReactNode }) {
  const key = `gift-seen-${attemptId}`;
  const [seen, setSeen] = useState<boolean | null>(null);
  const [opened, setOpened] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.rpc("attempt_gift_message", { _attempt_id: attemptId }).then(({ data }) => {
      const m = ((data as string | null) ?? "").trim();
      if (m === "__off__") { setSeen(true); return; }
      setMsg(m);
      setSeen(sessionStorage.getItem(key) === "1");
    });
  }, [key, attemptId]);

  const done = () => { sessionStorage.setItem(key, "1"); setSeen(true); };

  if (seen === null) return null;
  if (seen) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm">
      {!opened ? (
        <button type="button" onClick={() => setOpened(true)} className="flex flex-col items-center gap-4 animate-in zoom-in duration-500">
          <div className="flex h-36 w-36 items-center justify-center rounded-3xl bg-primary shadow-2xl animate-bounce">
            <Gift className="h-20 w-20 text-primary-foreground" />
          </div>
          <span className="rounded-full bg-background px-5 py-2 font-semibold text-foreground shadow">🎁 You have a surprise! Tap to open</span>
        </button>
      ) : (
        <div className="w-full max-w-md overflow-hidden rounded-3xl bg-background shadow-2xl animate-in zoom-in-50 fade-in duration-500">
          <div className="flex flex-col items-center gap-2 bg-primary px-6 py-6 text-primary-foreground">
            <Sparkles className="h-10 w-10" />
            <h2 className="text-center text-xl font-bold">A Quick Word From Your Examiner</h2>
          </div>
          <div className="space-y-5 p-6">
            <p className="whitespace-pre-wrap text-center text-base leading-relaxed text-foreground">{msg || DEFAULT_MSG}</p>
            <Button className="h-12 w-full text-base" onClick={done}>I'm Ready — Let's Do This! 🚀</Button>
          </div>
        </div>
      )}
    </div>
  );
}
