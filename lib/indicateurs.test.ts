/**
 * Étape 5 du cahier : un petit chantier fictif dont chaque indicateur a été
 * calculé à la main. Les valeurs attendues sont commentées à côté du test.
 */
import { describe, expect, it } from "vitest";
import { calculerIndicateurs, type Donnees } from "./indicateurs";

const j = (n: number) => new Date(Date.UTC(2026, 0, n));

const donnees: Donnees = {
  chantier: { budgetInitial: 1_000_000, budgetRevise: 1_000_000, dateDebutPrevue: j(1), dateFinPrevue: j(10), dateDebutReelle: j(1), seuilAlerteBudget: 90, seuils: {} },
  depenses: [
    { id: 1, date: j(1), montant: 100_000, categorie: "MATERIAUX", libelle: "a", statut: "VALIDEE", datePaiement: j(1), justifiee: true },
    { id: 2, date: j(2), montant: 200_000, categorie: "TRANSPORT", libelle: "b", statut: "VALIDEE", datePaiement: null, justifiee: false },
    { id: 3, date: j(3), montant: 50_000, categorie: "DIVERS", libelle: "c", statut: "REJETEE", datePaiement: null, justifiee: true },
    { id: 4, date: j(4), montant: 30_000, categorie: "DIVERS", libelle: "d", statut: "EN_ATTENTE", datePaiement: null, justifiee: true },
  ],
  avances: [
    { date: j(1), montant: 500_000, statut: "VALIDEE" },
    { date: j(4), montant: 100_000, statut: "EN_ATTENTE" },
  ],
  taches: [
    { id: 1, lot: "A", designation: "T1", unite: "m³", quantitePrevue: 10, coutPrevu: 600_000, dateDebutPrevue: j(1), dateFinPrevue: j(9), dateFinReelle: null, statut: "EN_COURS", causeRetard: null },
    { id: 2, lot: "B", designation: "T2", unite: "m²", quantitePrevue: 20, coutPrevu: 400_000, dateDebutPrevue: j(1), dateFinPrevue: j(5), dateFinReelle: j(5), statut: "TERMINEE", causeRetard: null },
  ],
  productions: [
    { tacheId: 1, date: j(2), quantite: 5, heuresTravaillees: 10, effectif: 2, statut: "VALIDEE" },
    { tacheId: 1, date: j(4), quantite: 3, heuresTravaillees: 8, effectif: 1, statut: "EN_ATTENTE" },
    { tacheId: 2, date: j(3), quantite: 20, heuresTravaillees: 8, effectif: 1, statut: "VALIDEE" },
  ],
  materiaux: [{ id: 1, designation: "Ciment", unite: "sac", categorie: "Liants", prixReference: 1000, delaiLivraisonJours: 3, seuilAlerteJours: 5 }],
  mouvements: [
    { materiauId: 1, type: "ENTREE", quantite: 100, prixUnitaire: 1000, date: j(1) },
    { materiauId: 1, type: "SORTIE", quantite: 20, prixUnitaire: null, date: j(2) },
    { materiauId: 1, type: "ENTREE", quantite: 50, prixUnitaire: 1300, date: j(3) },
    { materiauId: 1, type: "SORTIE", quantite: 20, prixUnitaire: null, date: j(3) },
    { materiauId: 1, type: "SORTIE", quantite: 20, prixUnitaire: null, date: j(4) },
    { materiauId: 1, type: "PERTE", quantite: 6, prixUnitaire: null, date: j(4) },
  ],
  inventaires: [{ materiauId: 1, date: j(4), stockTheorique: 84, stockPhysique: 84, valide: true }],
  presences: [
    { ouvrierId: 1, date: j(5), statut: "PRESENT", heuresPrevues: 8, heuresRealisees: 8, tauxJournalier: 6000, metier: "Maçon" },
    { ouvrierId: 2, date: j(5), statut: "RETARD", heuresPrevues: 8, heuresRealisees: 4, tauxJournalier: 4000, metier: "Manœuvre" },
  ],
  joursRepos: [],
  rapports: [],
};

const ind = calculerIndicateurs(donnees, j(5));

describe("finances (§ 4.1, RG-43)", () => {
  it("seules les dépenses validées consomment le budget", () => {
    expect(ind.finances.consomme).toBe(300_000); // 100 000 + 200 000
    expect(ind.finances.consommePct).toBe(30);
    expect(ind.finances.budgetRestant).toBe(700_000);
  });
  it("trésorerie = avances validées − dépenses payées", () => {
    expect(ind.finances.payees).toBe(100_000);
    expect(ind.finances.engagees).toBe(200_000);
    expect(ind.finances.tresorerie).toBe(400_000); // 500 000 − 100 000
  });
  it("taux de justification", () => {
    expect(ind.finances.tauxJustification).toBeCloseTo(33.333, 2); // 100 000 ÷ 300 000
  });
});

describe("avancement (RG-55) et valeur acquise", () => {
  it("avancement pondéré par le coût, productions validées seulement", () => {
    // T1 : 5/10 = 50 % ; T2 : 20/20 = 100 % ; (50 × 600 + 100 × 400) ÷ 1 000 = 70 %
    expect(ind.avancement.global).toBeCloseTo(70, 10);
  });
  it("SPI et CPI", () => {
    // VP = 600 000 × 4/8 + 400 000 × 1 = 700 000 ; VA = 300 000 + 400 000 = 700 000
    expect(ind.avancement.spi).toBeCloseTo(1, 10);
    expect(ind.avancement.cpi).toBeCloseTo(700 / 300, 10);
  });
});

describe("matériaux (§ 4.2)", () => {
  const m = ind.materiaux[0];
  it("stock théorique, pertes et prix moyen pondéré", () => {
    expect(m.stock).toBe(84); // 150 − 60 − 6
    expect(m.tauxPerte).toBe(4); // 6 ÷ 150
    expect(m.prixMoyenPondere).toBe(1100); // (100 × 1 000 + 50 × 1 300) ÷ 150
    expect(m.variationPrix).toBeCloseTo(30, 10); // dernier prix 1 300 contre 1 000
  });
  it("autonomie = stock ÷ consommation moyenne", () => {
    expect(m.consoMoyenne).toBe(12); // 60 sacs sur 5 jours ouvrés
    expect(m.autonomie).toBe(7);
  });
});

describe("productivité et présence (§ 4.3)", () => {
  it("productivité horaire", () => {
    expect(ind.productivite.parTache.find((t) => t.tacheId === 2)!.productiviteHoraire).toBe(2.5); // 20 m² ÷ 8 h
  });
  it("taux de présence", () => {
    expect(ind.personnel.tauxPresence).toBe(75); // 12 h ÷ 16 h
    expect(ind.personnel.coutMOTheorique).toBe(8000); // 6 000 + 4 000 × 4/8
  });
});

describe("alertes (§ 10 des règles)", () => {
  const codes = ind.alertes.map((a) => a.code).sort();
  it("déclenche exactement les alertes attendues", () => {
    // AL-07 : 400 000 ÷ 60 000 par jour = 6,7 jours < 7 ; AL-11 : pas de rapport le 4 ;
    // AL-13 : dépense de 200 000 sans justificatif depuis 3 jours ; AL-14 : présence 75 % < 80 %.
    expect(codes).toEqual(["AL-07", "AL-11", "AL-13", "AL-14"]);
  });
  it("chaque alerte explique sa règle, sa période et son responsable", () => {
    for (const a of ind.alertes) {
      expect(a.regle).not.toBe("");
      expect(a.periode).not.toBe("");
      expect(a.responsable).not.toBe("");
    }
  });
});
