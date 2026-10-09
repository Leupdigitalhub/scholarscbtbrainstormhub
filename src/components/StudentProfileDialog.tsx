import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAvatar } from "@/lib/avatar";

type P = { id: string; full_name: string; student_id: string; class: string; email: string; phone: string; created_at: string };
type R = { id: string; student_id: string; status: string; percent: number; test_title: string; started_at: string; passed: boolean };

export function StudentAvatar({ id, name, size = "h-9 w-9" }: { id: string; name: string; size?: string }) {
  const a = useAvatar(id);
  return a.data
    ? <img src={a.data} alt={name} className={`${size} shrink-0 rounded-full object-cover ring-2 ring-primary`} />
    : <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-muted font-bold`}>{(name || "?").charAt(0).toUpperCase()}</span>;
}

export function StudentProfileDialog({ s, results, onClose }: { s: P | null; results: R[]; onClose: () => void }) {
  const mine = s ? results.filter((r) => r.student_id === s.id) : [];
  const done = mine.filter((r) => r.status === "submitted");
  const avg = done.length ? Math.round(done.reduce((a, r) => a + r.percent, 0) / done.length) : null;
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {s && (<>
          <DialogHeader><DialogTitle>Student profile</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-2 text-center">
            <StudentAvatar id={s.id} name={s.full_name} size="h-32 w-32" />
            <p className="text-xl font-extrabold">{s.full_name}</p>
            <p className="font-mono font-bold">STUDENT ID: {s.student_id}</p>
            <p className="text-sm text-muted-foreground">{s.class} · Joined {new Date(s.created_at).toLocaleDateString()}</p>
            <p className="text-sm">{s.email}{s.phone && ` · ${s.phone}`}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-muted p-2"><b className="block text-lg">{done.length}</b>Tests</div>
            <div className="rounded-xl bg-muted p-2"><b className="block text-lg">{avg ?? "—"}{avg !== null && "%"}</b>Average</div>
            <div className="rounded-xl bg-muted p-2"><b className="block text-lg">{done.filter((r) => r.passed).length}</b>Passed</div>
          </div>
          <div className="space-y-1 text-sm">
            {mine.map((r) => (
              <Link key={r.id} to="/result/$attemptId" params={{ attemptId: r.id }} className="flex justify-between rounded-lg border p-2 hover:bg-muted">
                <span>{r.test_title}<span className="block text-xs text-muted-foreground">{new Date(r.started_at).toLocaleString()}</span></span>
                <b>{r.status === "submitted" ? `${r.percent}%` : "In progress"}</b>
              </Link>
            ))}
            {mine.length === 0 && <p className="text-center text-muted-foreground">No exams yet.</p>}
          </div>
        </>)}
      </DialogContent>
    </Dialog>
  );
}
