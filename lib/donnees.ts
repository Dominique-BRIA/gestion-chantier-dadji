import { prisma } from "./db";
import type { Donnees, Seuils } from "./indicateurs";

/** Lit en base toutes les observations d'un chantier, au format du moteur d'indicateurs. */
export async function chargerDonnees(chantierId: number): Promise<Donnees> {
  const c = await prisma.chantier.findUniqueOrThrow({
    where: { id: chantierId },
    include: {
      avenants: { orderBy: { date: "desc" }, take: 1 },
      depenses: true,
      avances: true,
      taches: { include: { productions: true } },
      materiaux: true,
      mouvements: true,
      inventaires: true,
      presences: { include: { ouvrier: true } },
      joursRepos: true,
      rapports: { select: { date: true } },
    },
  });
  return {
    chantier: {
      budgetInitial: c.budgetInitial,
      budgetRevise: c.avenants[0]?.nouveauBudget ?? c.budgetInitial,
      dateDebutPrevue: c.dateDebutPrevue,
      dateFinPrevue: c.dateFinPrevue,
      dateDebutReelle: c.dateDebutReelle,
      seuilAlerteBudget: c.seuilAlerteBudget,
      seuils: (c.seuils ?? {}) as Partial<Seuils>,
    },
    depenses: c.depenses.map((x) => ({
      id: x.id,
      date: x.date,
      montant: x.montant,
      categorie: x.categorie,
      libelle: x.libelle,
      statut: x.statut,
      datePaiement: x.datePaiement,
      justifiee: Boolean(x.justificatif || x.fichierCle),
    })),
    avances: c.avances.map((x) => ({ date: x.date, montant: x.montant, statut: x.statut })),
    taches: c.taches.map((t) => ({
      id: t.id,
      lot: t.lot,
      designation: t.designation,
      unite: t.unite,
      quantitePrevue: t.quantitePrevue,
      coutPrevu: t.coutPrevu,
      dateDebutPrevue: t.dateDebutPrevue,
      dateFinPrevue: t.dateFinPrevue,
      dateFinReelle: t.dateFinReelle,
      statut: t.statut,
      causeRetard: t.causeRetard,
    })),
    productions: c.taches.flatMap((t) =>
      t.productions.map((p) => ({
        tacheId: t.id,
        date: p.date,
        quantite: p.quantite,
        heuresTravaillees: p.heuresTravaillees,
        effectif: p.effectif,
        statut: p.statut,
      })),
    ),
    materiaux: c.materiaux,
    mouvements: c.mouvements.map((m) => ({ materiauId: m.materiauId, type: m.type, quantite: m.quantite, prixUnitaire: m.prixUnitaire, date: m.date })),
    inventaires: c.inventaires,
    presences: c.presences.map((p) => ({
      ouvrierId: p.ouvrierId,
      date: p.date,
      statut: p.statut,
      heuresPrevues: p.heuresPrevues,
      heuresRealisees: p.heuresRealisees,
      tauxJournalier: p.ouvrier.tauxJournalier ?? 0,
      metier: p.ouvrier.metier,
    })),
    joursRepos: c.joursRepos.map((r) => r.date),
    rapports: c.rapports.map((r) => r.date),
  };
}
