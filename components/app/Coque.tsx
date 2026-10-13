"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Building2, ChevronLeft, HardHat, LogOut, Menu, UserCircle, Users } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const ROLES: Record<string, string> = {
  INGENIEUR: "Ingénieur",
  CLIENT: "Client",
  CHEF_CHANTIER: "Chef de chantier",
  MANOEUVRE: "Manœuvre",
};

/** Coquille d'alanya-admin : barre latérale repliable, en-tête, zone défilante. */
export function Coque({
  nom,
  role,
  chantiers,
  deconnexion,
  children,
}: {
  nom: string;
  role: string;
  chantiers: { id: number; code: string; nom: string }[];
  deconnexion: () => Promise<void>;
  children: React.ReactNode;
}) {
  const chemin = usePathname();
  const [replie, setReplie] = useState(false);
  const items = [
    { href: "/chantiers", label: role === "INGENIEUR" ? "Mes chantiers" : "Chantiers", icon: Building2, exact: true },
    ...(role === "INGENIEUR" ? [{ href: "/utilisateurs", label: "Utilisateurs", icon: Users, exact: false }] : []),
  ];
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <aside className={cn("hidden md:flex flex-col border-r bg-white dark:bg-zinc-900 dark:border-zinc-800 transition-all duration-300", replie ? "w-16" : "w-64")}>
        <div className="flex items-center gap-3 px-4 h-16 border-b dark:border-zinc-800">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500">
            <HardHat className="h-5 w-5 text-white" />
          </div>
          {!replie && <span className="text-lg font-bold tracking-tight">Chantiers</span>}
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {items.map((it) => {
            const actif = it.exact ? chemin === it.href : chemin.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  actif ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
                )}
              >
                <it.icon className="h-5 w-5 shrink-0" />
                {!replie && it.label}
              </Link>
            );
          })}
          {!replie && chantiers.length > 0 && <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Chantiers</p>}
          {chantiers.map((c) => {
            const actif = chemin.startsWith(`/chantiers/${c.id}`);
            return (
              <Link
                key={c.id}
                href={`/chantiers/${c.id}`}
                title={c.nom}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  actif ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-medium" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
                )}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold">{c.code.slice(0, 1)}</span>
                {!replie && <span className="truncate">{c.nom}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t dark:border-zinc-800 p-2 space-y-1">
          {!replie && (
            <div className="flex items-center gap-3 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">
              <UserCircle className="h-5 w-5 shrink-0 text-indigo-500" />
              <div className="min-w-0">
                <p className="truncate font-medium">{nom}</p>
                <p className="text-zinc-400">{ROLES[role]}</p>
              </div>
            </div>
          )}
          <form action={deconnexion}>
            <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors">
              <LogOut className="h-5 w-5 shrink-0" />
              {!replie && "Déconnexion"}
            </button>
          </form>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b bg-white dark:bg-zinc-900 dark:border-zinc-800">
          <button onClick={() => setReplie(!replie)} className="hidden md:block p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400" aria-label="Replier le menu">
            {replie ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <Link href="/chantiers" className="md:hidden flex items-center gap-2 font-bold">
            <HardHat className="h-5 w-5 text-indigo-500" /> Chantiers
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-sm text-zinc-500">{ROLES[role]}</span>
            <ThemeToggle />
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
              {nom.split(" ").map((m) => m[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <form action={deconnexion} className="md:hidden">
              <button className="p-2 text-red-600" aria-label="Déconnexion">
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
