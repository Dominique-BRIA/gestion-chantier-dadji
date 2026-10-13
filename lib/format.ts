// Arrondis d'affichage seulement (RG-92) : les calculs gardent la pleine précision.

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("fr-FR", { minimumFractionDigits: min, maximumFractionDigits: max });

export function fcfa(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "non calculable";
  return `${nf(0, 0).format(Math.round(v))} FCFA`;
}

export function pct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "non calculable";
  return `${nf(1, 1).format(v)} %`;
}

export function nombre(v: number | null | undefined, decimales = 2): string {
  if (v == null || !Number.isFinite(v)) return "non calculable";
  return nf(0, decimales).format(v);
}

export function date(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

export function jourCourt(d: Date | string): string {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

/** Date du jour à minuit UTC : toutes les dates métier sont des jours, sans heure. */
export function aujourdhui(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function jourUTC(s: string | Date): Date {
  const d = new Date(s);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function ajouterJours(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export function ecartJours(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function cleJour(d: Date): string {
  return d.toISOString().slice(0, 10);
}
