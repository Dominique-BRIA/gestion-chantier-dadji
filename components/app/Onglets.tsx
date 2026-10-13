"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, HardHat, LayoutDashboard, Package, Settings, Users, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONES: Record<string, LucideIcon> = {
  "": LayoutDashboard,
  statistiques: BarChart3,
  travaux: HardHat,
  stock: Package,
  finances: Wallet,
  personnel: Users,
  rapports: ClipboardList,
  parametres: Settings,
};

export function Onglets({ base, onglets }: { base: string; onglets: [string, string][] }) {
  const chemin = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b dark:border-zinc-800 -mx-1 px-1">
      {onglets.map(([seg, label]) => {
        const href = seg ? `${base}/${seg}` : base;
        const actif = seg ? chemin.startsWith(href) : chemin === base;
        const Icone = ICONES[seg];
        return (
          <Link
            key={seg}
            href={href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              actif ? "border-indigo-500 text-indigo-700 dark:text-indigo-300" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200",
            )}
          >
            <Icone className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
