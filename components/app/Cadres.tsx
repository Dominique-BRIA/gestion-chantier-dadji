"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CalendarCheck,
  CalendarOff,
  ClipboardList,
  FilePlus2,
  Gauge,
  GitCompare,
  HardHat,
  History,
  Landmark,
  LineChart,
  ListChecks,
  MessageSquareWarning,
  Package,
  PieChart,
  Plus,
  Receipt,
  ScrollText,
  Settings2,
  SlidersHorizontal,
  Timer,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Les icônes voyagent par leur nom : une fonction ne passe pas du serveur au client.
const ICONES: Record<string, LucideIcon> = {
  alertes: AlertTriangle,
  stats: BarChart3,
  stock: Boxes,
  presence: CalendarCheck,
  repos: CalendarOff,
  rapport: ClipboardList,
  ajout: FilePlus2,
  jauge: Gauge,
  comparer: GitCompare,
  chantier: HardHat,
  historique: History,
  avances: Landmark,
  courbe: LineChart,
  taches: ListChecks,
  signalement: MessageSquareWarning,
  materiau: Package,
  camembert: PieChart,
  plus: Plus,
  depense: Receipt,
  journal: ScrollText,
  reglages: Settings2,
  seuils: SlidersHorizontal,
  attente: Timer,
  tendance: TrendingUp,
  pointage: UserCheck,
  equipe: Users,
  budget: Wallet,
};

export interface Cadre {
  id: string;
  titre: string;
  icone: keyof typeof ICONES;
  /** Petit compteur à côté du titre (éléments en attente, alertes…). */
  compte?: number;
  contenu: React.ReactNode;
}

/**
 * Un seul cadre visible à la fois : la page reste lisible, on passe de l'un à
 * l'autre par le sélecteur. Le choix est retenu le temps de la session, pour
 * revenir au même cadre après l'envoi d'un formulaire.
 */
export function Cadres({ cadres }: { cadres: Cadre[] }) {
  const chemin = usePathname();
  const cle = `cadre:${chemin}`;
  const [actif, setActif] = useState(cadres[0]?.id);

  useEffect(() => {
    try {
      const memo = sessionStorage.getItem(cle);
      if (memo && cadres.some((c) => c.id === memo)) setActif(memo);
    } catch {
      /* stockage indisponible : on garde le premier cadre */
    }
  }, [cle, cadres]);

  function choisir(id: string) {
    setActif(id);
    try {
      sessionStorage.setItem(cle, id);
    } catch {
      /* sans importance */
    }
  }

  const courant = cadres.find((c) => c.id === actif) ?? cadres[0];
  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1 shadow-sm">
        {cadres.map((c) => {
          const Icone = ICONES[c.icone];
          const choisi = c.id === courant.id;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={choisi}
              onClick={() => choisir(c.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
                choisi ? "bg-primary/10 text-primary dark:bg-primary/15" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icone className="h-4 w-4" />
              {c.titre}
              {!!c.compte && (
                <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", choisi ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
                  {c.compte}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Tous les cadres sont rendus, les autres masqués : une saisie en cours
          n'est pas perdue quand on passe d'un cadre à l'autre. */}
      {cadres.map((c) => (
        <div key={c.id} role="tabpanel" hidden={c.id !== courant.id} className="animate-in fade-in-0 duration-200">
          {c.contenu}
        </div>
      ))}
    </div>
  );
}
