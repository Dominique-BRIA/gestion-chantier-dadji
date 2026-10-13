import { HardHat, LogIn } from "lucide-react";
import { connexion } from "@/app/actions";
import { Bandeau } from "@/components/app/ui";

export default function PageConnexion({ searchParams }: { searchParams: { erreur?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-lg">
            <HardHat className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Gestion de chantier</h1>
            <p className="text-sm text-zinc-500">Suivi, statistiques et aide à la décision</p>
          </div>
        </div>
        <form action={connexion} className="space-y-4 rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow-sm">
          <Bandeau erreur={searchParams.erreur} />
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Téléphone</span>
            <input name="telephone" inputMode="tel" required autoComplete="username" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Mot de passe</span>
            <input name="motDePasse" type="password" required autoComplete="current-password" className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary h-10 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <LogIn className="h-4 w-4" /> Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
