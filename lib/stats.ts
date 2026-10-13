/**
 * Bibliothèque de statistique descriptive et inférentielle simple.
 *
 * Fonctions pures, sans dépendance : chaque formule est écrite en clair pour
 * pouvoir être relue et justifiée dans le rapport de l'UE. Les conventions
 * sont celles du cours :
 * - variance « population » (divisée par n) pour DÉCRIRE une série observée ;
 * - variance « échantillon » (divisée par n − 1) pour ESTIMER, dès qu'on
 *   généralise au-delà des jours observés (intervalles de confiance, prévisions).
 *
 * Toute fonction reçoit une série vide sans planter et renvoie NaN ou null :
 * c'est à l'écran d'afficher « données insuffisantes », pas à la bibliothèque
 * d'inventer un zéro.
 */

export function somme(x: readonly number[]): number {
  return x.reduce((s, v) => s + v, 0);
}

export function moyenne(x: readonly number[]): number {
  return x.length === 0 ? NaN : somme(x) / x.length;
}

/** Moyenne pondérée Σ(xᵢ·wᵢ) / Σwᵢ — sert à l'avancement global pondéré par le coût. */
export function moyennePonderee(x: readonly number[], poids: readonly number[]): number {
  const sw = somme(poids);
  if (x.length !== poids.length || sw === 0) return NaN;
  return x.reduce((s, v, i) => s + v * poids[i], 0) / sw;
}

function trie(x: readonly number[]): number[] {
  return [...x].sort((a, b) => a - b);
}

/**
 * Quantile d'ordre p (0 ≤ p ≤ 1) par interpolation linéaire entre les deux
 * observations encadrantes (méthode 7 de Hyndman & Fan, celle d'Excel
 * QUARTILE.INCLUS et de R par défaut) : les résultats se vérifient au tableur.
 */
export function quantile(x: readonly number[], p: number): number {
  if (x.length === 0) return NaN;
  const t = trie(x);
  const h = (t.length - 1) * p;
  const bas = Math.floor(h);
  const haut = Math.ceil(h);
  return t[bas] + (h - bas) * (t[haut] - t[bas]);
}

export function mediane(x: readonly number[]): number {
  return quantile(x, 0.5);
}

/** Mode(s) : la ou les valeurs les plus fréquentes. Vide si toutes sont uniques. */
export function modes(x: readonly number[]): number[] {
  const freq = new Map<number, number>();
  for (const v of x) freq.set(v, (freq.get(v) ?? 0) + 1);
  const max = Math.max(0, ...Array.from(freq.values()));
  if (max <= 1) return [];
  return Array.from(freq.entries())
    .filter(([, n]) => n === max)
    .map(([v]) => v)
    .sort((a, b) => a - b);
}

export function etendue(x: readonly number[]): number {
  return x.length === 0 ? NaN : Math.max(...x) - Math.min(...x);
}

/** Variance. `echantillon` = true divise par n − 1 (estimateur sans biais). */
export function variance(x: readonly number[], echantillon = false): number {
  const n = x.length;
  if (n === 0 || (echantillon && n < 2)) return NaN;
  const m = moyenne(x);
  const sc = x.reduce((s, v) => s + (v - m) ** 2, 0);
  return sc / (echantillon ? n - 1 : n);
}

export function ecartType(x: readonly number[], echantillon = false): number {
  return Math.sqrt(variance(x, echantillon));
}

/**
 * Coefficient de variation σ / x̄, en pourcentage. Repère usuel :
 * < 15 % série homogène, 15–30 % dispersion modérée, > 30 % série irrégulière.
 */
export function coefficientVariation(x: readonly number[]): number {
  const m = moyenne(x);
  return m === 0 ? NaN : (ecartType(x) / Math.abs(m)) * 100;
}

export interface Boite {
  min: number;
  q1: number;
  mediane: number;
  q3: number;
  max: number;
  iqr: number;
  /** Moustaches de Tukey : Q1 − 1,5·IQR et Q3 + 1,5·IQR. */
  bornesBasse: number;
  bornesHaute: number;
  /** Valeurs hors moustaches : les « journées atypiques ». */
  atypiques: number[];
}

export function boiteAMoustaches(x: readonly number[]): Boite | null {
  if (x.length === 0) return null;
  const q1 = quantile(x, 0.25);
  const q3 = quantile(x, 0.75);
  const iqr = q3 - q1;
  const bornesBasse = q1 - 1.5 * iqr;
  const bornesHaute = q3 + 1.5 * iqr;
  return {
    min: Math.min(...x),
    q1,
    mediane: mediane(x),
    q3,
    max: Math.max(...x),
    iqr,
    bornesBasse,
    bornesHaute,
    atypiques: x.filter((v) => v < bornesBasse || v > bornesHaute),
  };
}

/** Score z de chaque valeur : (x − x̄) / σ. |z| > 2 signale une valeur inhabituelle. */
export function scoresZ(x: readonly number[]): number[] {
  const m = moyenne(x);
  const s = ecartType(x);
  return x.map((v) => (s === 0 ? 0 : (v - m) / s));
}

export interface Classe {
  borneInf: number;
  borneSup: number;
  effectif: number;
  frequence: number;
}

/**
 * Histogramme en classes d'amplitude égale. Nombre de classes par la règle de
 * Sturges k = 1 + log₂(n), sauf si on l'impose.
 */
export function histogramme(x: readonly number[], k?: number): Classe[] {
  const n = x.length;
  if (n === 0) return [];
  const nb = k ?? Math.max(1, Math.ceil(1 + Math.log2(n)));
  const min = Math.min(...x);
  const max = Math.max(...x);
  const amplitude = (max - min) / nb || 1;
  const classes: Classe[] = Array.from({ length: nb }, (_, i) => ({
    borneInf: min + i * amplitude,
    borneSup: min + (i + 1) * amplitude,
    effectif: 0,
    frequence: 0,
  }));
  for (const v of x) {
    // La dernière classe est fermée à droite pour inclure le maximum.
    const i = Math.min(nb - 1, Math.floor((v - min) / amplitude));
    classes[i].effectif++;
  }
  for (const c of classes) c.frequence = c.effectif / n;
  return classes;
}

/** Covariance (population). */
export function covariance(x: readonly number[], y: readonly number[]): number {
  if (x.length !== y.length || x.length === 0) return NaN;
  const mx = moyenne(x);
  const my = moyenne(y);
  return x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / x.length;
}

/** Coefficient de corrélation linéaire de Pearson, entre −1 et 1. */
export function correlation(x: readonly number[], y: readonly number[]): number {
  const sx = ecartType(x);
  const sy = ecartType(y);
  if (sx === 0 || sy === 0) return NaN;
  return covariance(x, y) / (sx * sy);
}

export interface Regression {
  /** Pente a de y = a·x + b. */
  a: number;
  /** Ordonnée à l'origine b. */
  b: number;
  r: number;
  /** Coefficient de détermination : part de la variance de y expliquée par x. */
  r2: number;
  n: number;
  /** Écart-type résiduel s = √(SCR / (n − 2)). */
  ecartResiduel: number;
  predire: (x: number) => number;
}

/** Droite des moindres carrés de y en x : a = cov(x, y) / var(x), b = ȳ − a·x̄. */
export function regressionLineaire(x: readonly number[], y: readonly number[]): Regression | null {
  const n = x.length;
  if (n < 2 || n !== y.length) return null;
  const vx = variance(x);
  if (vx === 0) return null;
  const a = covariance(x, y) / vx;
  const b = moyenne(y) - a * moyenne(x);
  const r = correlation(x, y);
  const scr = x.reduce((s, v, i) => s + (y[i] - (a * v + b)) ** 2, 0);
  return {
    a,
    b,
    r,
    r2: r * r,
    n,
    ecartResiduel: n > 2 ? Math.sqrt(scr / (n - 2)) : NaN,
    predire: (v: number) => a * v + b,
  };
}

/** Moyenne mobile simple sur `fenetre` points ; null tant que la fenêtre n'est pas pleine. */
export function moyenneMobile(x: readonly number[], fenetre: number): (number | null)[] {
  return x.map((_, i) =>
    i + 1 < fenetre ? null : moyenne(x.slice(i + 1 - fenetre, i + 1)),
  );
}

/** Taux de variation (v₁ − v₀) / v₀ en pourcentage. */
export function tauxVariation(v0: number, v1: number): number {
  return v0 === 0 ? NaN : ((v1 - v0) / v0) * 100;
}

export function cumul(x: readonly number[]): number[] {
  let s = 0;
  return x.map((v) => (s += v));
}

export interface LignePareto<T> {
  element: T;
  valeur: number;
  part: number;
  partCumulee: number;
  /** Classe ABC : A jusqu'à 80 % du cumul, B jusqu'à 95 %, C au-delà. */
  classe: "A" | "B" | "C";
}

/** Tri décroissant, parts et cumul : diagramme de Pareto et classification ABC. */
export function pareto<T>(elements: readonly T[], valeur: (e: T) => number): LignePareto<T>[] {
  const lignes = elements
    .map((element) => ({ element, valeur: valeur(element) }))
    .sort((a, b) => b.valeur - a.valeur);
  const total = somme(lignes.map((l) => l.valeur));
  let cumulPart = 0;
  return lignes.map((l) => {
    const part = total === 0 ? 0 : (l.valeur / total) * 100;
    // La classe se décide sur le cumul AVANT l'élément : le premier élément
    // est toujours en A, même s'il pèse à lui seul plus de 80 %.
    const classe = cumulPart < 80 ? "A" : cumulPart < 95 ? "B" : "C";
    cumulPart += part;
    return { ...l, part, partCumulee: cumulPart, classe };
  });
}

/**
 * Quantile de la loi de Student à n − 2 degrés de liberté pour un niveau
 * bilatéral de 95 %. Table du cours jusqu'à 30, puis loi normale (1,96).
 */
export function studentT95(ddl: number): number {
  const table = [
    NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228,
    2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086,
    2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
  ];
  if (ddl < 1) return NaN;
  return ddl < table.length ? table[ddl] : 1.96;
}

/**
 * Intervalle de confiance à 95 % de la moyenne : x̄ ± t·s/√n, avec s
 * l'écart-type d'échantillon. Plus n est petit, plus l'intervalle est large :
 * c'est la traduction chiffrée de « trois jours ne suffisent pas ».
 */
export function intervalleConfianceMoyenne(x: readonly number[]): { bas: number; haut: number; marge: number } | null {
  const n = x.length;
  if (n < 2) return null;
  const marge = studentT95(n - 1) * (ecartType(x, true) / Math.sqrt(n));
  const m = moyenne(x);
  return { bas: m - marge, haut: m + marge, marge };
}
