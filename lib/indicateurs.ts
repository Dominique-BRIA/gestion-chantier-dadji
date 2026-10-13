/**
 * Moteur des indicateurs du chantier (cahier § 4 et § 5, règles RG-43 à RG-94).
 *
 * Fonction pure : elle reçoit les observations brutes et la date du jour, et
 * renvoie tous les indicateurs. Rien n'est lu en base ici, ce qui permet de
 * vérifier chaque formule à la main sur un petit jeu de données (étape 5 du
 * cahier, voir indicateurs.test.ts).
 */
import {
  boiteAMoustaches,
  coefficientVariation,
  correlation,
  cumul,
  ecartType,
  etendue,
  intervalleConfianceMoyenne,
  mediane,
  modes,
  moyenne,
  moyenneMobile,
  pareto,
  quantile,
  regressionLineaire,
  somme,
  type Boite,
  type Regression,
} from "./stats";
import { ajouterJours, cleJour, ecartJours } from "./format";

// ---------------------------------------------------------------- Entrées

type Statut = "EN_ATTENTE" | "VALIDEE" | "REJETEE";

export interface Donnees {
  chantier: {
    budgetInitial: number;
    budgetRevise: number;
    dateDebutPrevue: Date;
    dateFinPrevue: Date;
    dateDebutReelle: Date | null;
    seuilAlerteBudget: number;
    seuils: Partial<Seuils>;
  };
  depenses: { id: number; date: Date; montant: number; categorie: string; libelle: string; statut: Statut; datePaiement: Date | null; justifiee: boolean }[];
  avances: { date: Date; montant: number; statut: Statut }[];
  taches: {
    id: number;
    lot: string;
    designation: string;
    unite: string;
    quantitePrevue: number;
    coutPrevu: number;
    dateDebutPrevue: Date;
    dateFinPrevue: Date;
    dateFinReelle: Date | null;
    statut: "A_FAIRE" | "EN_COURS" | "TERMINEE";
    causeRetard: string | null;
  }[];
  productions: { tacheId: number; date: Date; quantite: number; heuresTravaillees: number; effectif: number; statut: Statut }[];
  materiaux: { id: number; designation: string; unite: string; categorie: string; prixReference: number; delaiLivraisonJours: number; seuilAlerteJours: number }[];
  mouvements: { materiauId: number; type: "ENTREE" | "SORTIE" | "PERTE" | "RETOUR" | "CORRECTION"; quantite: number; prixUnitaire: number | null; date: Date }[];
  inventaires: { materiauId: number; date: Date; stockTheorique: number; stockPhysique: number; valide: boolean }[];
  presences: { ouvrierId: number; date: Date; statut: "PRESENT" | "RETARD" | "ABSENT"; heuresPrevues: number; heuresRealisees: number; tauxJournalier: number; metier: string | null }[];
  joursRepos: Date[];
  rapports: Date[];
}

export interface Seuils {
  pertePct: number;
  ecartBudgetAvancementPts: number;
  joursTresorerie: number;
  ecartInventairePct: number;
  presencePct: number;
  attenteValidationJours: number;
  justificatifJours: number;
  concentrationRetardPct: number;
  joursSansInventaire: number;
}

export const SEUILS_DEFAUT: Seuils = {
  pertePct: 5,
  ecartBudgetAvancementPts: 10,
  joursTresorerie: 7,
  ecartInventairePct: 2,
  presencePct: 80,
  attenteValidationJours: 3,
  justificatifJours: 2,
  concentrationRetardPct: 50,
  joursSansInventaire: 7,
};

// ---------------------------------------------------------------- Sorties

export interface Descriptif {
  n: number;
  moyenne: number;
  mediane: number;
  modes: number[];
  ecartType: number;
  etendue: number;
  q1: number;
  q3: number;
  cv: number;
  boite: Boite | null;
  ic95: { bas: number; haut: number } | null;
}

export interface Alerte {
  code: string;
  niveau: "critique" | "attention";
  titre: string;
  message: string;
  regle: string;
  periode: string;
  responsable: string;
  decision: string;
}

// RG-91 : en dessous de ces effectifs, la statistique n'est pas affichée.
export const N_MIN = { moyenne: 3, dispersion: 5, boite: 10, regression: 7, prevision: 10 };

export function decrire(x: number[]): Descriptif {
  const n = x.length;
  const disp = n >= N_MIN.dispersion;
  return {
    n,
    moyenne: n >= N_MIN.moyenne ? moyenne(x) : NaN,
    mediane: n >= N_MIN.moyenne ? mediane(x) : NaN,
    modes: n >= N_MIN.moyenne ? modes(x) : [],
    ecartType: disp ? ecartType(x) : NaN,
    etendue: disp ? etendue(x) : NaN,
    q1: disp ? quantile(x, 0.25) : NaN,
    q3: disp ? quantile(x, 0.75) : NaN,
    cv: disp && moyenne(x) > 0 ? coefficientVariation(x) : NaN,
    boite: n >= N_MIN.boite ? boiteAMoustaches(x) : null,
    ic95: disp ? intervalleConfianceMoyenne(x) : null,
  };
}

const div = (a: number, b: number) => (b === 0 ? NaN : a / b);
const statutValide = (s: Statut) => s === "VALIDEE";

/** Sens d'un mouvement sur le stock (RG-22). */
export function signeMouvement(type: Donnees["mouvements"][number]["type"]): number {
  return type === "ENTREE" || type === "CORRECTION" ? 1 : -1;
}

export function calculerIndicateurs(d: Donnees, jour: Date, dureePeriode = 30) {
  const seuils: Seuils = { ...SEUILS_DEFAUT, ...d.chantier.seuils };
  const debut = d.chantier.dateDebutReelle ?? d.chantier.dateDebutPrevue;
  const repos = new Set(d.joursRepos.map(cleJour));
  const finPeriode = jour;
  const debutPeriode = ajouterJours(jour, -(dureePeriode - 1));
  const dansPeriode = (x: Date) => x >= debutPeriode && x <= finPeriode;
  const periode = `du ${cleJour(debutPeriode)} au ${cleJour(finPeriode)}`;

  // RG-90 : jours ouvrés = tous les jours, sauf les jours de repos déclarés.
  const joursOuvres: Date[] = [];
  for (let x = debut; x <= jour; x = ajouterJours(x, 1)) if (!repos.has(cleJour(x))) joursOuvres.push(x);
  const joursPeriode = joursOuvres.filter(dansPeriode);

  // ------------------------------------------------------------ Finances (§ 4.1, RG-43)
  const depVal = d.depenses.filter((x) => statutValide(x.statut));
  const consomme = somme(depVal.map((x) => x.montant));
  const payees = somme(depVal.filter((x) => x.datePaiement && x.datePaiement <= jour).map((x) => x.montant));
  const avancesValidees = somme(d.avances.filter((x) => statutValide(x.statut)).map((x) => x.montant));
  const budget = d.chantier.budgetRevise;
  const tresorerie = avancesValidees - payees;

  const parJour = new Map<string, number>();
  for (const x of depVal) parJour.set(cleJour(x.date), (parJour.get(cleJour(x.date)) ?? 0) + x.montant);
  // Jours observés = jours ouvrés de la période où au moins une dépense existe.
  const serieDepenses = joursPeriode.map((x) => ({ date: cleJour(x), montant: parJour.get(cleJour(x)) ?? 0 }));
  const montantsObserves = serieDepenses.filter((x) => x.montant > 0).map((x) => x.montant);
  const mm7 = moyenneMobile(serieDepenses.map((x) => x.montant), 7);
  const depensesPeriode = somme(montantsObserves);
  const coutMoyenJournalier = div(depensesPeriode, joursPeriode.length);
  const coutMoyen14 = div(somme(serieDepenses.slice(-14).map((x) => x.montant)), Math.min(14, serieDepenses.length));

  const parCategorie = pareto(
    Object.entries(
      depVal.reduce<Record<string, number>>((acc, x) => ((acc[x.categorie] = (acc[x.categorie] ?? 0) + x.montant), acc), {}),
    ),
    ([, v]) => v,
  ).map((l) => ({ categorie: l.element[0], montant: l.valeur, part: l.part, partCumulee: l.partCumulee, classe: l.classe }));

  // ------------------------------------------------------------ Avancement (§ 4.4, RG-55, valeur acquise)
  const prodVal = d.productions.filter((x) => statutValide(x.statut));
  const qteParTache = new Map<number, number>();
  for (const p of prodVal) qteParTache.set(p.tacheId, (qteParTache.get(p.tacheId) ?? 0) + p.quantite);

  const taches = d.taches.map((t) => {
    const realise = qteParTache.get(t.id) ?? 0;
    const taux = Math.min(100, div(realise, t.quantitePrevue) * 100 || 0);
    const fin = t.dateFinReelle ?? (jour > t.dateFinPrevue ? jour : null);
    const retard = fin ? Math.max(0, ecartJours(t.dateFinPrevue, fin)) : 0;
    const dureePrevue = Math.max(1, ecartJours(t.dateDebutPrevue, t.dateFinPrevue));
    // Part du coût prévu qui devrait être réalisée aujourd'hui (plan linéaire).
    const fractionPlan = Math.min(1, Math.max(0, ecartJours(t.dateDebutPrevue, jour) / dureePrevue));
    return {
      ...t,
      realise,
      taux,
      depassement: realise > t.quantitePrevue,
      retard: t.statut === "TERMINEE" || jour > t.dateFinPrevue ? retard : 0,
      tauxRetard: (retard / dureePrevue) * 100,
      valeurPlanifiee: t.coutPrevu * fractionPlan,
      valeurAcquise: (t.coutPrevu * taux) / 100,
    };
  });
  const poids = somme(taches.map((t) => t.coutPrevu));
  const avancement = div(somme(taches.map((t) => t.taux * t.coutPrevu)), poids);
  const VP = somme(taches.map((t) => t.valeurPlanifiee));
  const VA = somme(taches.map((t) => t.valeurAcquise));
  const avancementPrevu = div(VP, poids) * 100;

  // Avancement global cumulé, jour par jour (validé seulement, RG-53).
  const tacheParId = new Map(d.taches.map((t) => [t.id, t]));
  const gainParJour = new Map<string, number>();
  for (const p of prodVal) {
    const t = tacheParId.get(p.tacheId);
    if (!t || !poids) continue;
    const gain = (Math.min(p.quantite, t.quantitePrevue) / t.quantitePrevue) * (t.coutPrevu / poids) * 100;
    gainParJour.set(cleJour(p.date), (gainParJour.get(cleJour(p.date)) ?? 0) + gain);
  }
  const cumulAv = cumul(joursOuvres.map((x) => gainParJour.get(cleJour(x)) ?? 0)).map((v) => Math.min(100, v));
  const serieAvancement = joursOuvres.map((x, i) => {
    const dureeTotale = Math.max(1, ecartJours(d.chantier.dateDebutPrevue, d.chantier.dateFinPrevue));
    return {
      date: cleJour(x),
      reel: cumulAv[i],
      prevu: Math.min(100, Math.max(0, (ecartJours(d.chantier.dateDebutPrevue, x) / dureeTotale) * 100)),
    };
  });

  // RG-93 : date de fin estimée par régression de l'avancement cumulé.
  const joursAvecProd = serieAvancement.map((p, i) => ({ x: i, y: p.reel })).filter((p) => p.y > 0);
  const regAv = regressionLineaire(joursAvecProd.map((p) => p.x), joursAvecProd.map((p) => p.y));
  let dateFinEstimee: string | null = null;
  let fiabiliteFin = "tendance non fiable";
  if (regAv && regAv.n >= N_MIN.prevision && regAv.r2 >= 0.8 && regAv.a > 0) {
    const indice = Math.ceil((100 - regAv.b) / regAv.a);
    dateFinEstimee = cleJour(ajouterJours(debut, indice + d.joursRepos.filter((r) => r >= debut).length));
    fiabiliteFin = `si le rythme moyen observé se maintient (r² = ${regAv.r2.toFixed(2)}, n = ${regAv.n})`;
  }

  const terminees = taches.filter((t) => t.statut === "TERMINEE");
  const retards = taches.filter((t) => t.retard > 0);
  const retardParLot = pareto(
    Object.entries(retards.reduce<Record<string, number>>((a, t) => ((a[t.lot] = (a[t.lot] ?? 0) + t.retard), a), {})),
    ([, v]) => v,
  ).map((l) => ({ lot: l.element[0], jours: l.valeur, part: l.part }));
  const retardParCause = Object.entries(
    retards.reduce<Record<string, number>>((a, t) => {
      const c = t.causeRetard ?? "Non déclarée";
      a[c] = (a[c] ?? 0) + t.retard;
      return a;
    }, {}),
  ).map(([cause, jours]) => ({ cause, jours }));

  // ------------------------------------------------------------ Productivité (§ 4.3)
  const prodPeriode = prodVal.filter((p) => dansPeriode(p.date) && p.heuresTravaillees > 0);
  const productivite = d.taches
    .map((t) => {
      const obs = prodPeriode.filter((p) => p.tacheId === t.id).sort((a, b) => +a.date - +b.date);
      const ph = obs.map((p) => p.quantite / p.heuresTravaillees);
      return {
        tacheId: t.id,
        designation: t.designation,
        unite: t.unite,
        n: obs.length,
        productiviteHoraire: div(somme(obs.map((p) => p.quantite)), somme(obs.map((p) => p.heuresTravaillees))),
        serie: obs.map((p, i) => ({ date: cleJour(p.date), valeur: ph[i] })),
        cv: obs.length >= N_MIN.dispersion ? coefficientVariation(ph) : NaN,
      };
    })
    .filter((x) => x.n > 0);

  // Corrélation heures travaillées / quantité produite, sur la tâche la plus observée
  // (RG-94 : jamais deux unités d'ouvrage mélangées dans un même nuage).
  const tachePrincipale = [...productivite].sort((a, b) => b.n - a.n)[0];
  const nuage = tachePrincipale
    ? prodPeriode.filter((p) => p.tacheId === tachePrincipale.tacheId).map((p) => ({ x: p.heuresTravaillees, y: p.quantite, effectif: p.effectif }))
    : [];
  const regProd: Regression | null =
    nuage.length >= N_MIN.regression ? regressionLineaire(nuage.map((p) => p.x), nuage.map((p) => p.y)) : null;
  const correlationEffectif =
    nuage.length >= N_MIN.regression ? correlation(nuage.map((p) => p.effectif), nuage.map((p) => p.y / p.x)) : NaN;

  // ------------------------------------------------------------ Présence et main-d'œuvre (RG-44, RG-60)
  const presPeriode = d.presences.filter((p) => dansPeriode(p.date));
  const heuresPrevues = somme(presPeriode.map((p) => p.heuresPrevues));
  const heuresRealisees = somme(presPeriode.map((p) => p.heuresRealisees));
  const tauxPresence = div(heuresRealisees, heuresPrevues) * 100;
  const heuresSup = somme(presPeriode.map((p) => Math.max(0, p.heuresRealisees - p.heuresPrevues)));
  const coutMOTheorique = somme(d.presences.map((p) => div(p.heuresRealisees, p.heuresPrevues) * p.tauxJournalier || 0));
  const coutMOPaye = somme(depVal.filter((x) => x.categorie === "MAIN_OEUVRE").map((x) => x.montant));
  const presParJour = new Map<string, { prevues: number; realisees: number; presents: number; total: number }>();
  for (const p of presPeriode) {
    const k = cleJour(p.date);
    const v = presParJour.get(k) ?? { prevues: 0, realisees: 0, presents: 0, total: 0 };
    v.prevues += p.heuresPrevues;
    v.realisees += p.heuresRealisees;
    v.total += 1;
    if (p.statut !== "ABSENT") v.presents += 1;
    presParJour.set(k, v);
  }
  const seriePresence = joursPeriode
    .map((x) => ({ date: cleJour(x), v: presParJour.get(cleJour(x)) }))
    .filter((x) => x.v)
    .map((x) => ({ date: x.date, taux: (x.v!.realisees / x.v!.prevues) * 100, presents: x.v!.presents, total: x.v!.total }));
  const presenceDuJour = presParJour.get(cleJour(jour)) ?? null;

  // ------------------------------------------------------------ Matériaux (§ 4.2)
  const materiaux = d.materiaux.map((m) => {
    const mv = d.mouvements.filter((x) => x.materiauId === m.id);
    const tot = (t: string) => somme(mv.filter((x) => x.type === t).map((x) => x.quantite));
    const entrees = tot("ENTREE");
    const sorties = tot("SORTIE");
    const pertes = tot("PERTE");
    const stock = somme(mv.map((x) => signeMouvement(x.type) * x.quantite));
    const achats = mv.filter((x) => x.type === "ENTREE" && x.prixUnitaire != null);
    const pmp = div(somme(achats.map((x) => x.quantite * x.prixUnitaire!)), somme(achats.map((x) => x.quantite)));
    const dernierPrix = achats.length ? [...achats].sort((a, b) => +a.date - +b.date).at(-1)!.prixUnitaire! : NaN;
    // Consommation moyenne sur les 10 derniers jours ouvrés (AL-01).
    const dix = joursOuvres.slice(-10);
    const consoDix = somme(mv.filter((x) => x.type === "SORTIE" && dix.some((j) => +j === +x.date)).map((x) => x.quantite));
    const consoMoyenne = div(consoDix, dix.length);
    const autonomie = consoMoyenne > 0 ? stock / consoMoyenne : NaN;
    const consoJour = joursPeriode.map((j) =>
      somme(mv.filter((x) => x.type === "SORTIE" && +x.date === +j).map((x) => x.quantite)),
    );
    const pertes14 = (a: number, b: number) => {
      const de = ajouterJours(jour, -b);
      const a_ = ajouterJours(jour, -a);
      const dans = (x: { date: Date }) => x.date > de && x.date <= a_;
      return div(
        somme(mv.filter((x) => x.type === "PERTE" && dans(x)).map((x) => x.quantite)),
        somme(mv.filter((x) => (x.type === "SORTIE" || x.type === "PERTE") && dans(x)).map((x) => x.quantite)),
      ) * 100;
    };
    const inv = d.inventaires.filter((x) => x.materiauId === m.id).sort((a, b) => +b.date - +a.date);
    const dernierInvValide = inv.find((x) => x.valide) ?? null;
    return {
      ...m,
      entrees,
      sorties,
      pertes,
      retours: tot("RETOUR"),
      stock,
      tauxPerte: div(pertes, entrees) * 100,
      pertesRecentes: pertes14(0, 14),
      pertesPrecedentes: pertes14(14, 28),
      prixMoyenPondere: pmp,
      variationPrix: div(dernierPrix - m.prixReference, m.prixReference) * 100,
      consoMoyenne,
      autonomie,
      valeurConsommee: sorties * (Number.isFinite(pmp) ? pmp : m.prixReference),
      descriptifConso: decrire(consoJour.filter((v) => v > 0)),
      serieConso: joursPeriode.map((j, i) => ({ date: cleJour(j), quantite: consoJour[i] })),
      dernierInventaire: inv[0] ?? null,
      ecartInventaire: inv[0] ? inv[0].stockPhysique - inv[0].stockTheorique : NaN,
      ecartInventairePct: inv[0] ? div(inv[0].stockPhysique - inv[0].stockTheorique, inv[0].stockTheorique) * 100 : NaN,
      joursDepuisInventaire: dernierInvValide ? ecartJours(dernierInvValide.date, jour) : Infinity,
      // Rendement des matériaux : quantité d'ouvrage réalisée par unité consommée,
      // sur les sorties rattachées à une tâche (§ 4.3).
    };
  });
  const abc = pareto(materiaux, (m) => m.valeurConsommee).map((l) => ({
    designation: l.element.designation,
    valeur: l.valeur,
    part: l.part,
    partCumulee: l.partCumulee,
    classe: l.classe,
  }));

  // ------------------------------------------------------------ Alertes (§ 10 des règles)
  const alertes: Alerte[] = [];
  const ingenieur = "Ingénieur";
  const chef = "Chef de chantier, puis ingénieur";
  for (const m of materiaux) {
    if (Number.isFinite(m.autonomie) && m.autonomie < m.seuilAlerteJours) {
      const critique = m.autonomie < m.delaiLivraisonJours;
      alertes.push({
        code: "AL-01",
        niveau: critique ? "critique" : "attention",
        titre: `Réapprovisionner : ${m.designation}`,
        message: `Autonomie ${m.autonomie.toFixed(1)} j (stock ${m.stock.toFixed(1)} ${m.unite}, consommation ${m.consoMoyenne.toFixed(1)} ${m.unite}/j) ; délai de livraison ${m.delaiLivraisonJours} j.`,
        regle: `Autonomie < seuil d'alerte (${m.seuilAlerteJours} j) ; critique si < délai de livraison`,
        periode: "10 derniers jours ouvrés",
        responsable: chef,
        decision: "Commander maintenant ou réviser le calendrier d'approvisionnement",
      });
    }
    // Sans période précédente, la hausse n'est pas mesurable : pas d'alerte (RG-92).
    if (m.pertesRecentes > seuils.pertePct && Number.isFinite(m.pertesPrecedentes) && m.pertesRecentes > m.pertesPrecedentes) {
      alertes.push({
        code: "AL-02",
        niveau: "attention",
        titre: `Pertes en hausse : ${m.designation}`,
        message: `${m.pertesRecentes.toFixed(1)} % des quantités utilisées perdues sur 14 jours, contre ${m.pertesPrecedentes.toFixed(1)} % avant.`,
        regle: `Taux de perte sur 14 j > ${seuils.pertePct} % et en hausse`,
        periode: "14 derniers jours contre les 14 précédents",
        responsable: chef,
        decision: "Vérifier le stockage, les sorties et les déclarations",
      });
    }
    if (Number.isFinite(m.ecartInventairePct) && Math.abs(m.ecartInventairePct) > seuils.ecartInventairePct) {
      alertes.push({
        code: "AL-12",
        niveau: "attention",
        titre: `Écart d'inventaire : ${m.designation}`,
        message: `Écart de ${m.ecartInventaire.toFixed(1)} ${m.unite} (${m.ecartInventairePct.toFixed(1)} %) au dernier inventaire.`,
        regle: `|écart| > ${seuils.ecartInventairePct} % du stock théorique`,
        periode: `Inventaire du ${cleJour(m.dernierInventaire!.date)}`,
        responsable: chef,
        decision: "Recompter, puis expliquer l'écart",
      });
    }
    if (m.joursDepuisInventaire > seuils.joursSansInventaire && m.entrees > 0) {
      alertes.push({
        code: "AL-15",
        niveau: "attention",
        titre: `Inventaire en retard : ${m.designation}`,
        message: Number.isFinite(m.joursDepuisInventaire)
          ? `Dernier inventaire validé il y a ${m.joursDepuisInventaire} jours.`
          : "Aucun inventaire validé.",
        regle: `Plus de ${seuils.joursSansInventaire} jours sans inventaire validé (RG-25)`,
        periode: "Depuis le dernier inventaire validé",
        responsable: chef,
        decision: "Faire l'inventaire hebdomadaire",
      });
    }
  }
  const consommePct = div(consomme, budget) * 100;
  if (consommePct - avancement > seuils.ecartBudgetAvancementPts) {
    alertes.push({
      code: "AL-03",
      niveau: "attention",
      titre: "Dépenses plus rapides que les travaux",
      message: `Budget consommé ${consommePct.toFixed(1)} % pour un avancement validé de ${avancement.toFixed(1)} %.`,
      regle: `Écart > ${seuils.ecartBudgetAvancementPts} points`,
      periode: "Depuis le début du chantier",
      responsable: ingenieur,
      decision: "Examiner les achats anticipés et le stock avant de conclure à un dépassement",
    });
  }
  for (const p of productivite) {
    const s = p.serie.map((x) => x.valeur);
    if (s.length >= 5 && s.at(-1)! < s.at(-2)! && s.at(-2)! < s.at(-3)! && s.at(-3)! < s.at(-4)!) {
      alertes.push({
        code: "AL-04",
        niveau: "attention",
        titre: `Rendement en baisse : ${p.designation}`,
        message: `Productivité horaire en baisse 3 jours de suite (${s.at(-4)!.toFixed(2)} → ${s.at(-1)!.toFixed(2)} ${p.unite}/h).`,
        regle: "Baisse sur 3 observations consécutives, n ≥ 5",
        periode,
        responsable: ingenieur,
        decision: "Analyser les causes : météo, approvisionnement, effectif",
      });
    }
  }
  const totalRetard = somme(retards.map((t) => t.retard));
  if (retardParLot[0] && retards.length >= 2 && retardParLot[0].part >= seuils.concentrationRetardPct) {
    alertes.push({
      code: "AL-05",
      niveau: "attention",
      titre: `Retards concentrés sur le lot « ${retardParLot[0].lot} »`,
      message: `${retardParLot[0].jours} jours sur ${totalRetard} jours de retard cumulés (${retardParLot[0].part.toFixed(0)} %).`,
      regle: `Un lot ≥ ${seuils.concentrationRetardPct} % des jours de retard`,
      periode: "Depuis le début du chantier",
      responsable: ingenieur,
      decision: "Réorganiser le planning et examiner les dépendances",
    });
  }
  // AL-06 : Tukey par catégorie, au moins 10 dépenses de référence.
  for (const cat of Array.from(new Set(depVal.map((x) => x.categorie)))) {
    const lot = depVal.filter((x) => x.categorie === cat);
    if (lot.length < 10) continue;
    const b = boiteAMoustaches(lot.map((x) => x.montant))!;
    for (const x of lot.filter((x) => x.montant > b.bornesHaute && dansPeriode(x.date))) {
      alertes.push({
        code: "AL-06",
        niveau: "attention",
        titre: `Dépense inhabituelle : ${x.libelle}`,
        message: `${Math.round(x.montant).toLocaleString("fr-FR")} FCFA le ${cleJour(x.date)}, au-delà de Q3 + 1,5 × IQR (${Math.round(b.bornesHaute).toLocaleString("fr-FR")} FCFA) pour cette catégorie.`,
        regle: "Montant > Q3 + 1,5 × IQR de la même catégorie (n ≥ 10)",
        periode,
        responsable: ingenieur,
        decision: "Demander une justification et vérifier les pièces",
      });
    }
  }
  const joursTreso = div(tresorerie, coutMoyen14);
  if (tresorerie <= 0 || (Number.isFinite(joursTreso) && joursTreso < seuils.joursTresorerie)) {
    alertes.push({
      code: "AL-07",
      niveau: tresorerie <= 0 ? "critique" : "attention",
      titre: "Trésorerie insuffisante",
      message: `Trésorerie ${Math.round(tresorerie).toLocaleString("fr-FR")} FCFA, soit ${Number.isFinite(joursTreso) ? joursTreso.toFixed(1) : "0"} jours au rythme des 14 derniers jours.`,
      regle: `Trésorerie ÷ coût moyen journalier (14 j) < ${seuils.joursTresorerie} jours`,
      periode: "14 derniers jours ouvrés",
      responsable: ingenieur,
      decision: "Demander une avance au client",
    });
  }
  const enAttente = d.productions.filter((p) => p.statut === "EN_ATTENTE" && ecartJours(p.date, jour) > seuils.attenteValidationJours);
  if (enAttente.length) {
    alertes.push({
      code: "AL-08",
      niveau: "attention",
      titre: "Travaux déclarés non validés",
      message: `${enAttente.length} déclaration(s) de production attendent depuis plus de ${seuils.attenteValidationJours} jours.`,
      regle: `Production en attente > ${seuils.attenteValidationJours} jours`,
      periode: "Déclarations en attente",
      responsable: ingenieur,
      decision: "Organiser un contrôle sur le terrain, puis valider",
    });
  }
  if (consommePct >= d.chantier.seuilAlerteBudget) {
    alertes.push({
      code: "AL-09",
      niveau: consommePct >= 100 ? "critique" : "attention",
      titre: "Budget presque épuisé",
      message: `${consommePct.toFixed(1)} % du budget consommé.`,
      regle: `Budget consommé ≥ ${d.chantier.seuilAlerteBudget} %`,
      periode: "Depuis le début du chantier",
      responsable: ingenieur,
      decision: "Préparer un avenant ou un arbitrage",
    });
  }
  if (dateFinEstimee && dateFinEstimee > cleJour(d.chantier.dateFinPrevue)) {
    alertes.push({
      code: "AL-10",
      niveau: "attention",
      titre: "Dépassement de délai prévisible",
      message: `Fin estimée le ${dateFinEstimee} pour une fin prévue le ${cleJour(d.chantier.dateFinPrevue)}, ${fiabiliteFin}.`,
      regle: "Date de fin estimée par régression > date de fin prévue (RG-93)",
      periode: "Depuis le début du chantier",
      responsable: ingenieur,
      decision: "Renforcer l'équipe ou revoir le planning",
    });
  }
  const hier = ajouterJours(jour, -1);
  const rapports = new Set(d.rapports.map(cleJour));
  if (hier >= debut && !repos.has(cleJour(hier)) && !rapports.has(cleJour(hier))) {
    alertes.push({
      code: "AL-11",
      niveau: "attention",
      titre: "Rapport journalier manquant",
      message: `Aucun rapport pour le ${cleJour(hier)}.`,
      regle: "Pas de rapport du jour J à J + 1, 12 h",
      periode: cleJour(hier),
      responsable: "Chef de chantier",
      decision: "Relancer le chef de chantier",
    });
  }
  const nonJustifiees = d.depenses.filter((x) => x.statut !== "REJETEE" && !x.justifiee && ecartJours(x.date, jour) > seuils.justificatifJours);
  if (nonJustifiees.length) {
    alertes.push({
      code: "AL-13",
      niveau: "attention",
      titre: "Dépenses non justifiées",
      message: `${nonJustifiees.length} dépense(s) sans justificatif depuis plus de 48 h, pour ${Math.round(somme(nonJustifiees.map((x) => x.montant))).toLocaleString("fr-FR")} FCFA.`,
      regle: "Dépense sans justificatif depuis plus de 48 h",
      periode: "Toutes les dépenses non rejetées",
      responsable: ingenieur,
      decision: "Réclamer les pièces",
    });
  }
  if (presenceDuJour && (presenceDuJour.realisees / presenceDuJour.prevues) * 100 < seuils.presencePct) {
    alertes.push({
      code: "AL-14",
      niveau: "attention",
      titre: "Présence faible aujourd'hui",
      message: `${presenceDuJour.presents} présents sur ${presenceDuJour.total} (${((presenceDuJour.realisees / presenceDuJour.prevues) * 100).toFixed(0)} % des heures prévues).`,
      regle: `Taux de présence du jour < ${seuils.presencePct} %`,
      periode: cleJour(jour),
      responsable: chef,
      decision: "Vérifier les causes d'absence",
    });
  }

  return {
    periode,
    nJoursOuvres: joursOuvres.length,
    nJoursPeriode: joursPeriode.length,
    finances: {
      budgetInitial: d.chantier.budgetInitial,
      budget,
      consomme,
      consommePct,
      payees,
      engagees: consomme - payees,
      avancesValidees,
      tresorerie,
      budgetRestant: budget - consomme,
      coutMoyenJournalier,
      coutMoyen14,
      joursTresorerie: joursTreso,
      ecartBudgetaire: consomme - VP,
      tauxJustification: div(somme(depVal.filter((x) => x.justifiee).map((x) => x.montant)), consomme) * 100,
      parCategorie,
      serieDepenses: serieDepenses.map((x, i) => ({ ...x, moyenneMobile: mm7[i] })),
      descriptif: decrire(montantsObserves),
      histogramme: montantsObserves,
    },
    avancement: {
      global: avancement,
      prevu: avancementPrevu,
      valeurPlanifiee: VP,
      valeurAcquise: VA,
      // Indices de la valeur acquise : < 1 = en retard (SPI) ou au-dessus du coût (CPI).
      spi: div(VA, VP),
      cpi: div(VA, consomme),
      serie: serieAvancement,
      dateFinEstimee,
      fiabiliteFin,
      regression: regAv && { a: regAv.a, b: regAv.b, r2: regAv.r2, n: regAv.n },
      taches,
      nTerminees: terminees.length,
      aTemps: div(terminees.filter((t) => t.retard === 0).length, terminees.length) * 100,
      retardMoyen: retards.length ? moyenne(retards.map((t) => t.retard)) : 0,
      retardParLot,
      retardParCause,
    },
    productivite: {
      parTache: productivite,
      tachePrincipale: tachePrincipale?.designation ?? null,
      unitePrincipale: tachePrincipale?.unite ?? null,
      nuage,
      regression: regProd && { a: regProd.a, b: regProd.b, r: regProd.r, r2: regProd.r2, n: regProd.n },
      correlationEffectif,
    },
    personnel: {
      tauxPresence,
      heuresPrevues,
      heuresRealisees,
      heuresSup,
      coutMOTheorique,
      coutMOPaye,
      seriePresence,
      presenceDuJour,
      descriptifPresence: decrire(seriePresence.map((x) => x.taux)),
    },
    materiaux,
    abc,
    alertes: alertes.sort((a, b) => (a.niveau === b.niveau ? a.code.localeCompare(b.code) : a.niveau === "critique" ? -1 : 1)),
  };
}

export type Indicateurs = ReturnType<typeof calculerIndicateurs>;
