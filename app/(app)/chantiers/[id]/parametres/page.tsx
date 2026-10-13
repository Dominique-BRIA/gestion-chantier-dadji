import { prisma } from "@/lib/db";
import { exigerChantier } from "@/lib/auth";
import { SEUILS_DEFAUT, type Seuils } from "@/lib/indicateurs";
import { STATUTS_CHANTIER } from "@/lib/labels";
import { changerStatutChantier, modifierSeuils } from "@/app/actions";
import { Bandeau, Bouton, Champ, Section, Tableau } from "@/components/app/ui";

const ACTIONS: Record<string, [string, string][]> = {
  PREPARATION: [["EN_COURS", "Démarrer le chantier"]],
  EN_COURS: [
    ["SUSPENDU", "Suspendre"],
    ["TERMINE", "Clôturer le chantier"],
  ],
  SUSPENDU: [["EN_COURS", "Reprendre"]],
  TERMINE: [],
};

const LIBELLES: [keyof Seuils, string][] = [
  ["pertePct", "AL-02 : taux de perte (%)"],
  ["ecartBudgetAvancementPts", "AL-03 : écart budget − avancement (points)"],
  ["joursTresorerie", "AL-07 : trésorerie minimale (jours)"],
  ["ecartInventairePct", "AL-12 : écart d'inventaire (%)"],
  ["presencePct", "AL-14 : présence minimale (%)"],
  ["attenteValidationJours", "AL-08 : attente de validation (jours)"],
];

export default async function Parametres({ params, searchParams }: { params: { id: string }; searchParams: { erreur?: string; ok?: string } }) {
  const { chantier } = await exigerChantier(Number(params.id), ["INGENIEUR"]);
  const retour = `/chantiers/${chantier.id}/parametres`;
  const seuils = { ...SEUILS_DEFAUT, ...(chantier.seuils as Partial<Seuils>) };
  const journal = await prisma.journalAudit.findMany({
    where: {
      OR: [
        { entite: "Chantier", entiteId: chantier.id },
        { auteur: { OR: [{ affectations: { some: { chantierId: chantier.id } } }, { chantiersDiriges: { some: { id: chantier.id } } }] } },
      ],
    },
    include: { auteur: true },
    orderBy: { date: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section titre="Cycle de vie du chantier" description={`Statut actuel : ${STATUTS_CHANTIER[chantier.statut]}. La clôture exige qu'aucune validation ne soit en attente (RG-11).`}>
          <div className="space-y-3">
            {ACTIONS[chantier.statut].map(([cible, label]) => (
              <form key={cible} action={changerStatutChantier} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="chantierId" value={chantier.id} />
                <input type="hidden" name="retour" value={retour} />
                <input type="hidden" name="statut" value={cible} />
                {cible === "SUSPENDU" && <Champ label="Motif de suspension" name="motif" />}
                <Bouton variante={cible === "TERMINE" ? "danger" : "primaire"}>{label}</Bouton>
              </form>
            ))}
            {chantier.statut === "TERMINE" && <p className="text-sm text-zinc-500">Chantier clôturé : lecture seule.</p>}
          </div>
        </Section>
        <Section titre="Seuils de validation et d'alerte" description="Valeurs par défaut des règles de gestion, modifiables pour ce chantier (§ 10).">
          <form action={modifierSeuils} className="grid gap-3 sm:grid-cols-2 items-end">
            <input type="hidden" name="chantierId" value={chantier.id} />
            <input type="hidden" name="retour" value={retour} />
            <Champ label="Validation des dépenses au-delà de (FCFA)" name="seuilValidation" type="number" defaultValue={chantier.seuilValidation} />
            <Champ label="AL-09 : alerte budget (%)" name="seuilAlerteBudget" type="number" defaultValue={chantier.seuilAlerteBudget} />
            {LIBELLES.map(([k, l]) => (
              <Champ key={k} label={l} name={k} type="number" step="0.1" defaultValue={seuils[k]} />
            ))}
            <div>
              <Bouton>Enregistrer les seuils</Bouton>
            </div>
          </form>
        </Section>
      </div>
      <Section titre="Journal d'audit" description="Qui a fait quoi, quand, avec l'ancienne et la nouvelle valeur. Écriture seule (RG-81).">
        <Tableau entetes={["Date", "Auteur", "Action", "Objet", "Détail"]} vide={!journal.length}>
          {journal.map((j) => (
            <tr key={j.id}>
              <td className="whitespace-nowrap text-xs">{j.date.toLocaleString("fr-FR")}</td>
              <td className="text-xs">
                {j.auteur.prenom} {j.auteur.nom}
              </td>
              <td className="text-xs font-medium">{j.action}</td>
              <td className="text-xs">
                {j.entite} n° {j.entiteId}
              </td>
              <td className="text-xs text-zinc-500 font-mono max-w-md truncate">{j.nouvelleValeur}</td>
            </tr>
          ))}
        </Tableau>
      </Section>
    </div>
  );
}
