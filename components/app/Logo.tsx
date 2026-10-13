import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Symbole du logo sur une tuile sombre : le casque et l'arc sont blancs, ils
 * resteraient invisibles sur un fond clair.
 */
export function Logo({ taille = 40, className }: { taille?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-xl bg-[#14141f] ring-1 ring-white/10", className)}
      style={{ width: taille, height: taille, padding: taille * 0.12 }}
    >
      <Image src="/logo.png" alt="Logo" width={340} height={283} className="h-full w-full object-contain" priority />
    </span>
  );
}

export function Marque({ taille = 40 }: { taille?: number }) {
  return (
    <span className="flex items-center gap-3">
      <Logo taille={taille} />
      <span className="leading-tight">
        <span className="block font-bold tracking-tight">Gestion de chantier</span>
        <span className="block text-xs text-muted-foreground">Dadji Rick-Mael · Ingénieur en génie civil</span>
      </span>
    </span>
  );
}
