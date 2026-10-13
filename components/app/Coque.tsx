"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Building2, ChevronLeft, LogOut, Menu, UserCircle2, Users } from "lucide-react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

const ROLES: Record<string, string> = {
  INGENIEUR: "Ingénieur",
  CLIENT: "Client",
  CHEF_CHANTIER: "Chef de chantier",
  MANOEUVRE: "Manœuvre",
};

const lien = (actif: boolean) =>
  cn(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
    actif ? "bg-primary/10 text-primary dark:bg-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );

/** Coquille d'alanya-admin : barre latérale repliable, en-tête, zone défilante. */
export function Coque({
  nom,
  role,
  chantiers,
  logo,
  deconnexion,
  children,
}: {
  nom: string;
  role: string;
  chantiers: { id: number; code: string; nom: string }[];
  logo: React.ReactNode;
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
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className={cn("hidden md:flex flex-col border-r border-border bg-card transition-all duration-300", replie ? "w-[72px]" : "w-64")}>
        <Link href="/" className="flex items-center gap-3 px-4 h-16 border-b border-border">
          {logo}
          {!replie && <span className="font-bold tracking-tight leading-tight">Gestion de chantier</span>}
        </Link>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((it) => (
            <Link key={it.href} href={it.href} className={lien(it.exact ? chemin === it.href : chemin.startsWith(it.href))}>
              <it.icon className="h-5 w-5 shrink-0" />
              {!replie && it.label}
            </Link>
          ))}
          {!replie && chantiers.length > 0 && <p className="px-3 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Chantiers</p>}
          {chantiers.map((c) => (
            <Link key={c.id} href={`/chantiers/${c.id}`} title={c.nom} className={lien(chemin.startsWith(`/chantiers/${c.id}`))}>
              <Building2 className="h-5 w-5 shrink-0" />
              {!replie && <span className="truncate">{c.nom}</span>}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-3 space-y-1">
          {!replie && (
            <div className="flex items-center gap-3 px-3 py-2 text-xs">
              <UserCircle2 className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate font-medium">{nom}</p>
                <p className="text-muted-foreground">{ROLES[role]}</p>
              </div>
            </div>
          )}
          <form action={deconnexion}>
            <button className="flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors">
              <LogOut className="h-5 w-5 shrink-0" />
              {!replie && "Déconnexion"}
            </button>
          </form>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-border bg-card/80 backdrop-blur">
          <button onClick={() => setReplie(!replie)} className="hidden md:block p-2 rounded-xl hover:bg-muted text-muted-foreground" aria-label="Replier le menu">
            {replie ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>
          <Link href="/chantiers" className="md:hidden flex items-center gap-2 font-bold">
            {logo} Chantiers
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground">
              <UserCircle2 className="h-4 w-4" />
              {nom} · {ROLES[role]}
            </span>
            <ThemeToggle />
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
