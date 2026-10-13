import Link from "next/link";
import { ArrowLeft, Lock, LogIn, Phone } from "lucide-react";
import { connexion } from "@/app/actions";
import { Bandeau } from "@/components/app/ui";
import { Logo } from "@/components/app/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

const champ =
  "h-11 w-full rounded-xl border border-input bg-background/60 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function PageConnexion({ searchParams }: { searchParams: { erreur?: string } }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.15)_0%,transparent_60%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.22)_0%,transparent_60%)]" />
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card/90 p-8 shadow-xl backdrop-blur dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="mt-6 flex justify-center">
          <Logo taille={72} className="rounded-2xl" />
        </div>
        <h1 className="mt-5 text-center text-2xl font-bold tracking-tight">Connexion</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Accédez à l&apos;espace de vos chantiers</p>

        <form action={connexion} className="mt-7 space-y-4">
          <Bandeau erreur={searchParams.erreur} />
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Téléphone</span>
            <span className="relative block">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input name="telephone" inputMode="tel" required autoComplete="username" placeholder="6XX XXX XXX" className={champ} />
            </span>
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Mot de passe</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input name="motDePasse" type="password" required autoComplete="current-password" placeholder="Votre mot de passe" className={champ} />
            </span>
          </label>
          <button className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(234,88,12,0.4)] hover:brightness-110">
            <LogIn className="h-4 w-4" /> Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
