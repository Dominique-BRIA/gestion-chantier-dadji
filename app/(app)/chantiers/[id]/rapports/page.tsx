import { prisma } from "@/lib/db";
import { exigerChantier } from "@/lib/auth";
import { aujourdhui, cleJour, date } from "@/lib/format";
import { STATUTS_SIGNALEMENT, STATUTS_VALIDATION, TYPES_SIGNALEMENT } from "@/lib/labels";
import { creerSignalement, soumettreRapport, traiterSignalement, validerRapport } from "@/app/actions";
import { ActionLigne, Bandeau, Bouton, Champ, Choix, Formulaire, Pastille, Section, Tableau, tonStatut } from "@/components/app/ui";

const zone = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

export default async function Rapports({ params, searchParams }: { params: { id: string }; searchParams: { erreur?: string; ok?: string } }) {
  const { s, chantier } = await exigerChantier(Number(params.id), ["INGENIEUR", "CLIENT", "CHEF_CHANTIER"]);
  const id = chantier.id;
  const retour = `/chantiers/${id}/rapports`;
  const cache = { chantierId: id, retour };
  const ouvert = chantier.statut === "EN_COURS";
  const [rapports, signalements] = await Promise.all([
    // RG-65 : le client ne lit que les rapports validés.
    prisma.rapportJournalier.findMany({ where: { chantierId: id, ...(s.role === "CLIENT" ? { statut: "VALIDEE" as const } : {}) }, include: { auteur: true }, orderBy: { date: "desc" }, take: 30 }),
    prisma.signalement.findMany({ where: { chantierId: id, ...(s.role === "CLIENT" ? { auteurId: s.id } : {}) }, include: { auteur: true }, orderBy: [{ statut: "asc" }, { date: "desc" }] }),
  ]);
  const typesPermis = s.role === "CLIENT" ? (["ANOMALIE", "DEMANDE_JUSTIFICATION"] as const) : (Object.keys(TYPES_SIGNALEMENT) as (keyof typeof TYPES_SIGNALEMENT)[]);

  return (
    <div className="space-y-6">
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      <div className="space-y-3">
        {ouvert && s.role !== "CLIENT" && (
          <Formulaire action={soumettreRapport} titre="Soumettre le rapport journalier (RG-65)" cache={cache}>
            <Champ label="Date" name="date" type="date" defaultValue={cleJour(aujourdhui())} />
            <Choix label="Météo" name="meteo" options={["Ensoleillé", "Nuageux", "Pluie", "Orage"].map((m) => [m, m])} />
            <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-3">
              <span className="font-medium">Travaux réalisés</span>
              <textarea name="travaux" required rows={2} className={zone} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Incidents</span>
              <textarea name="incidents" rows={2} className={zone} />
            </label>
            <label className="space-y-1 text-sm sm:col-span-2">
              <span className="font-medium">Observations</span>
              <textarea name="observations" rows={2} className={zone} />
            </label>
          </Formulaire>
        )}
        <Formulaire action={creerSignalement} titre={s.role === "CLIENT" ? "Signaler une anomalie ou demander une justification" : "Créer un signalement"} cache={cache} bouton="Envoyer">
          <Choix label="Type" name="type" options={typesPermis.map((k) => [k, TYPES_SIGNALEMENT[k]])} />
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium">Description</span>
            <textarea name="description" required rows={2} className={zone} />
          </label>
        </Formulaire>
      </div>

      <Section titre="Signalements" description="Une demande d'examen, pas une accusation. L'ingénieur répond par écrit avant de clore (RG-70).">
        <Tableau entetes={["Date", "Auteur", "Type", "Description", "Statut", "Réponse"]} vide={!signalements.length}>
          {signalements.map((x) => (
            <tr key={x.id}>
              <td className="whitespace-nowrap">{date(x.date)}</td>
              <td className="text-xs">
                {x.auteur.prenom} {x.auteur.nom}
              </td>
              <td className="text-xs">{TYPES_SIGNALEMENT[x.type]}</td>
              <td className="max-w-xs">{x.description}</td>
              <td>
                <Pastille ton={tonStatut(x.statut)}>{STATUTS_SIGNALEMENT[x.statut]}</Pastille>
              </td>
              <td className="min-w-[220px]">
                {x.statut !== "CLOS" && s.role === "INGENIEUR" ? (
                  <form action={traiterSignalement} className="flex gap-1">
                    {Object.entries({ ...cache, id: x.id, statut: "CLOS" }).map(([k, v]) => (
                      <input key={k} type="hidden" name={k} value={v} />
                    ))}
                    <input name="reponse" required placeholder="Réponse écrite" defaultValue={x.reponse ?? ""} className="h-7 flex-1 rounded-md border border-input bg-background px-2 text-xs" />
                    <Bouton className="h-7 px-2 text-xs">Clore</Bouton>
                  </form>
                ) : (
                  <span className="text-xs text-zinc-500">{x.reponse ?? "—"}</span>
                )}
              </td>
            </tr>
          ))}
        </Tableau>
      </Section>

      <Section titre="Rapports journaliers" description={s.role === "CLIENT" ? "Rapports validés par l'ingénieur." : "Un rapport par jour ouvré ; un rapport manquant le lendemain à midi déclenche AL-11."}>
        <Tableau entetes={["Date", "Météo", "Travaux", "Incidents", "Statut"]} vide={!rapports.length}>
          {rapports.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap">{date(r.date)}</td>
              <td className="text-xs">{r.meteo}</td>
              <td className="max-w-md text-xs">{r.travaux}</td>
              <td className="text-xs text-amber-700 dark:text-amber-400">{r.incidents}</td>
              <td>
                {r.statut === "EN_ATTENTE" && s.role === "INGENIEUR" && ouvert ? (
                  <ActionLigne action={validerRapport} champs={{ ...cache, id: r.id }} variante="primaire">
                    Valider
                  </ActionLigne>
                ) : (
                  <Pastille ton={tonStatut(r.statut)}>{STATUTS_VALIDATION[r.statut]}</Pastille>
                )}
              </td>
            </tr>
          ))}
        </Tableau>
      </Section>
    </div>
  );
}
