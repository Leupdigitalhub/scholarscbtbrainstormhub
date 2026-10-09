import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Laptop, LineChart, MousePointerClick, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import hall from "@/assets/cbt-hall.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SCHOLARS CBT — Learn. Practice. Test. Succeed." },
      { name: "description", content: "An online CBT platform that helps students take lesson tests, practice their knowledge, and receive instant results." },
      { property: "og:title", content: "SCHOLARS CBT — Learn. Practice. Test. Succeed." },
      { property: "og:description", content: "An online CBT platform that helps students take lesson tests, practice their knowledge, and receive instant results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

const U = (id: string, w = 600) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;
const HERO = U("1481627834876-b7833e8f5570", 1600);

const features = [
  { icon: Laptop, img: U("1588072432836-e10032774350"), t: "Online CBT", d: "Take tests on any phone, tablet or computer." },
  { icon: Zap, img: U("1551288049-bebda4e38f71"), t: "Instant Results", d: "See your score and grade the moment you submit." },
  { icon: MousePointerClick, img: U("1434030216411-0b793f4b4173"), t: "Easy Testing", d: "One question at a time, flag and review before submitting." },
  { icon: LineChart, img: U("1522202176988-66273c2fd55f"), t: "Scholar Progress", d: "Every result is saved so you can track how you improve." },
  { icon: ShieldCheck, img: U("1563986768609-322da13575f3"), t: "Secure Platform", d: "Your answers and results are private to you." },
];

function Home() {
  return (
    <main className="min-h-screen">
      <section className="relative overflow-hidden text-foreground">
        <img src={HERO} alt="Scholars studying in a quiet library" width={1600} height={1000} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/30" />
        <div className="relative mx-auto max-w-5xl px-5 pb-24 pt-8">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success text-success-foreground shadow-sm"><GraduationCap className="h-7 w-7" /></span>
            <span className="leading-tight">
              <span className="block font-display text-2xl font-extrabold tracking-wide sm:text-3xl">SCHOLARS CBT</span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.25em] opacity-80 sm:text-xs">Learn · Practice · Test</span>
            </span>
          </div>
          <div className="pt-20 sm:pt-24">
            <p className="inline-block rounded-full bg-success px-3 py-1 text-sm font-bold text-success-foreground">Scholarly Excellence · Digital Learning</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">Where Scholars Master Every Subject</h1>
            <p className="mt-5 max-w-xl text-lg opacity-90">
              Sharpen your mind, build real test confidence and see your results instantly — the SCHOLARS way.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-14 bg-success px-8 text-lg text-success-foreground hover:bg-success/90">
                <Link to="/register">Create Student Account</Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="h-14 px-8 text-lg">
                <Link to="/login">Student Login</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto -mt-10 grid max-w-5xl grid-cols-2 gap-3 px-5 pb-16 sm:grid-cols-3 lg:grid-cols-5">
        {features.map((f, i) => (
          <div key={f.t} style={{ animationDelay: `${i * 0.1}s` }} className="animate-float-up overflow-hidden rounded-2xl border bg-card/95 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="relative aspect-[4/3]">
              <img src={f.img} alt={f.t} loading="lazy" className="h-full w-full object-cover" />
              <span style={{ animationDelay: `${i * 0.5}s` }} className="animate-glow absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-lg bg-success text-success-foreground"><f.icon className="h-4 w-4" /></span>
            </div>
            <div className="p-3">
              <p className="font-display text-sm font-bold">{f.t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.d}</p>
            </div>
          </div>
        ))}
      </section>
      <footer className="pb-8 text-center text-sm text-muted-foreground">© SCHOLARS CBT · <Link to="/staff" className="underline opacity-60 hover:opacity-100">Staff login</Link></footer>
    </main>
  );
}
