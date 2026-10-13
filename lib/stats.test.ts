import { describe, expect, it } from "vitest";
import {
  boiteAMoustaches,
  coefficientVariation,
  correlation,
  ecartType,
  etendue,
  histogramme,
  intervalleConfianceMoyenne,
  mediane,
  modes,
  moyenne,
  moyenneMobile,
  moyennePonderee,
  pareto,
  quantile,
  regressionLineaire,
  scoresZ,
  tauxVariation,
  variance,
} from "./stats";

// Série de référence : x̄ = 5 et σ = 2, vérifiables de tête.
const serie = [2, 4, 4, 4, 5, 5, 7, 9];

describe("tendance centrale", () => {
  it("moyenne, médiane, mode", () => {
    expect(moyenne(serie)).toBe(5);
    expect(mediane(serie)).toBe(4.5);
    expect(modes(serie)).toEqual([4]);
    expect(modes([1, 2, 3])).toEqual([]);
  });
  it("moyenne pondérée : une tâche à 100 % pesant 1, une à 0 % pesant 3", () => {
    expect(moyennePonderee([100, 0], [1, 3])).toBe(25);
  });
  it("série vide : NaN, jamais zéro", () => {
    expect(moyenne([])).toBeNaN();
    expect(mediane([])).toBeNaN();
  });
});

describe("dispersion", () => {
  it("variance par n et par n − 1", () => {
    expect(variance(serie)).toBe(4);
    expect(ecartType(serie)).toBe(2);
    expect(variance(serie, true)).toBeCloseTo(32 / 7, 10);
  });
  it("étendue, quartiles méthode tableur, coefficient de variation", () => {
    expect(etendue(serie)).toBe(7);
    expect(quantile(serie, 0.25)).toBe(4);
    expect(quantile(serie, 0.75)).toBe(5.5);
    expect(coefficientVariation(serie)).toBe(40);
  });
  it("boîte à moustaches : 40 est atypique", () => {
    const b = boiteAMoustaches([10, 11, 12, 12, 13, 14, 40])!;
    expect(b.q1).toBe(11.5);
    expect(b.q3).toBe(13.5);
    expect(b.atypiques).toEqual([40]);
  });
  it("scores z", () => {
    const z = scoresZ(serie);
    expect(z[0]).toBe(-1.5);
    expect(z[7]).toBe(2);
  });
});

describe("liaison entre deux variables", () => {
  it("droite des moindres carrés : a = 0,6, b = 2,2, r² = 0,6", () => {
    const r = regressionLineaire([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])!;
    expect(r.a).toBeCloseTo(0.6, 10);
    expect(r.b).toBeCloseTo(2.2, 10);
    expect(r.r2).toBeCloseTo(0.6, 10);
    expect(r.predire(6)).toBeCloseTo(5.8, 10);
  });
  it("corrélation parfaite, et indéfinie si une variable est constante", () => {
    expect(correlation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
    expect(correlation([1, 2, 3], [5, 5, 5])).toBeNaN();
  });
  it("pas de régression si x est constant", () => {
    expect(regressionLineaire([2, 2, 2], [1, 2, 3])).toBeNull();
  });
});

describe("séries chronologiques et répartition", () => {
  it("moyenne mobile", () => {
    expect(moyenneMobile([1, 2, 3, 4], 2)).toEqual([null, 1.5, 2.5, 3.5]);
  });
  it("taux de variation", () => {
    expect(tauxVariation(200, 250)).toBe(25);
    expect(tauxVariation(0, 5)).toBeNaN();
  });
  it("histogramme de Sturges : 8 valeurs → 4 classes", () => {
    expect(histogramme([1, 2, 3, 4, 5, 6, 7, 8]).map((c) => c.effectif)).toEqual([2, 2, 2, 2]);
  });
  it("Pareto et classes ABC", () => {
    const p = pareto([5, 50, 15, 30], (v) => v);
    expect(p.map((l) => l.valeur)).toEqual([50, 30, 15, 5]);
    expect(p.map((l) => l.classe)).toEqual(["A", "A", "B", "C"]);
    expect(p[3].partCumulee).toBeCloseTo(100, 10);
  });
  it("intervalle de confiance à 95 % (Student, 7 ddl)", () => {
    expect(intervalleConfianceMoyenne(serie)!.marge).toBeCloseTo(1.788, 3);
    expect(intervalleConfianceMoyenne([3])).toBeNull();
  });
});
