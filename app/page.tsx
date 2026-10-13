import Link from "next/link";
import { ArrowRight, BarChart3, BellRing, Boxes, HardHat, LayoutDashboard, LogIn, ShieldCheck, UserRound, Users, Wallet } from "lucide-react";
import { session } from "@/lib/auth";
import { Logo } from "@/components/app/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const ATOUTS = [
  { icone: Boxes, titre: "Stock maîtrisé", texte: "Entrées, sorties, pertes et inventaires hebdomadaires ; l'autonomie de chaque matériau en jours." },
  { icone: Wallet, titre: "Finances claires", texte: "Avances du client, dépenses engagées et payées, trésorerie réellement disponible." },
  { icone: BarChart3, titre: "Statistiques utiles", texte: "Tendances, dispersion, régression, Pareto et date de fin estimée, période et effectif toujours affichés." },
  { icone: BellRing, titre: "Alertes expliquées", texte: "Quinze alertes, chacune avec sa règle, sa période et la décision à prendre." },
];

const ACTEURS = [
  { icone: ShieldCheck, titre: "Ingénieur", texte: "Pilote ses chantiers et valide." },
  { icone: UserRound, titre: "Client", texte: "Suit l'avancement et verse ses avances." },
  { icone: HardHat, titre: "Chef de chantier", texte: "Saisit les opérations du jour." },
  { icone: Users, titre: "Manœuvre", texte: "Pointe et signale sur le terrain." },
];

export default async function Accueil() {
  const s = await session();
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Lueur orange d'alanyaCenter, plus marquée en mode sombre */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.14)_0%,transparent_55%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.22)_0%,transparent_55%)]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link
          href={s ? "/espace" : "/login"}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 px-4 h-10 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(234,88,12,0.35)] hover:brightness-110"
        >
          {s ? <LayoutDashboard className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          {s ? "Mon espace" : "Connexion"}
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-20">
        <section className="flex flex-col items-center pt-10 pb-16 text-center">
          <Logo taille={104} className="rounded-3xl shadow-xl" />
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-primary">Dadji Rick-Mael · Ingénieur en génie civil</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Pilotez vos chantiers avec des chiffres <span className="text-primary">fiables</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Une plateforme qui relie les matériaux, les dépenses, les travaux réalisés et les heures de travail, pour décider au bon moment.
          </p>
          <Link
            href={s ? "/espace" : "/login"}
            className="mt-8 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 h-11 text-sm font-semibold shadow-sm hover:border-primary/50"
          >
            {s ? "Ouvrir mon espace" : "Accéder à la plateforme"}
            <ArrowRight className="h-4 w-4 text-primary" />
          </Link>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ATOUTS.map((a) => (
            <div key={a.titre} className="rounded-2xl border border-border bg-card/80 p-5 backdrop-blur dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <a.icone className="h-5 w-5" />
              </span>
              <h2 className="mt-4 font-semibold">{a.titre}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{a.texte}</p>
            </div>
          ))}
        </section>

        <section className="mt-16">
          <h2 className="text-center text-xl font-bold">Un espace pour chaque acteur</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ACTEURS.map((a) => (
              <div key={a.titre} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-4">
                <a.icone className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{a.titre}</p>
                  <p className="text-xs text-muted-foreground">{a.texte}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border py-6 text-center text-xs text-muted-foreground">
        Gestion de chantier · Système d&apos;information et aide à la décision
      </footer>
    </div>
  );
}
