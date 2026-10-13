import { Banknote, FileCheck2, PiggyBank, Receipt, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigerChantier } from "@/lib/auth";
import { chargerDonnees } from "@/lib/donnees";
import { calculerIndicateurs } from "@/lib/indicateurs";
import { lienJustificatif, stockageActif } from "@/lib/fichiers";
import { aujourdhui, cleJour, date, fcfa, pct } from "@/lib/format";
import { CATEGORIES_DEPENSE, MODES_PAIEMENT, STATUTS_VALIDATION } from "@/lib/labels";
import { ajouterAvenant, creerDepense, deciderAvance, deciderDepense, declarerAvance, justifierDepense, payerDepense } from "@/app/actions";
import { ActionLigne, Bandeau, Bouton, Champ, Choix, Formulaire, Note, Pastille, Section, StatCard, Tableau, tonStatut } from "@/components/app/ui";

export default async function Finances({ params, searchParams }: { params: { id: string }; searchParams: { erreur?: string; ok?: string; filtre?: string } }) {
  const { s, chantier } = await exigerChantier(Number(params.id), ["INGENIEUR", "CLIENT", "CHEF_CHANTIER"]);
  const id = chantier.id;
  const retour = `/chantiers/${id}/finances`;
  const cache = { chantierId: id, retour };
  const ing = s.role === "INGENIEUR";
  const ouvert = chantier.statut === "EN_COURS";
  const ind = calculerIndicateurs(await chargerDonnees(id), aujourdhui());
  const f = ind.finances;
  // RG-45 : le client ne voit que les dépenses validées.
  const filtre = searchParams.filtre === "attente" ? { statut: "EN_ATTENTE" as const } : s.role === "CLIENT" ? { statut: "VALIDEE" as const } : {};
  const [depenses, avances, avenants] = await Promise.all([
    prisma.depense.findMany({ where: { chantierId: id, ...filtre }, include: { auteur: true }, orderBy: [{ date: "desc" }, { id: "desc" }], take: 60 }),
    prisma.avance.findMany({ where: { chantierId: id }, orderBy: { date: "desc" } }),
    prisma.avenant.findMany({ where: { chantierId: id }, orderBy: { date: "desc" } }),
  ]);
  const liens = new Map(await Promise.all(depenses.filter((d) => d.fichierCle).map(async (d) => [d.id, await lienJustificatif(d.fichierCle!)] as const)));
  const nAttente = await prisma.depense.count({ where: { chantierId: id, statut: "EN_ATTENTE" } });

  return (
    <div className="space-y-6">
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      {s.role !== "CHEF_CHANTIER" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard titre="Budget (révisé)" valeur={fcfa(f.budget)} icone={Wallet} sousTitre={f.budget !== f.budgetInitial ? `Initial : ${fcfa(f.budgetInitial)}` : "Aucun avenant"} />
          <StatCard titre="Budget restant" valeur={fcfa(f.budgetRestant)} icone={PiggyBank} couleur="#8b5cf6" sousTitre={`${pct(f.consommePct)} consommé`} />
          <StatCard titre="Avances validées" valeur={fcfa(f.avancesValidees)} icone={Banknote} couleur="#10b981" />
          <StatCard titre="Trésorerie" valeur={fcfa(f.tresorerie)} icone={Receipt} couleur={f.tresorerie < 0 ? "#ef4444" : "#06b6d4"} sousTitre={`Engagé non payé : ${fcfa(f.engagees)}`} />
          <StatCard titre="Justification" valeur={pct(f.tauxJustification)} icone={FileCheck2} couleur="#f59e0b" sousTitre="Dépenses justifiées ÷ total" />
        </div>
      )}
      {s.role !== "CHEF_CHANTIER" && (
        <Note>
          Le budget restant est l&apos;enveloppe non consommée ; la trésorerie est l&apos;argent réellement disponible : avances validées − dépenses payées. Une
          dépense validée mais non payée est « engagée » (RG-43).
        </Note>
      )}

      {ouvert && s.role !== "CLIENT" && (
        <Formulaire action={creerDepense} titre={`Enregistrer une dépense — validation automatique jusqu'à ${fcfa(chantier.seuilValidation)} (RG-41)`} cache={cache}>
          <Choix label="Catégorie" name="categorie" options={Object.entries(CATEGORIES_DEPENSE)} />
          <Champ label="Libellé" name="libelle" />
          <Champ label="Montant (FCFA)" name="montant" type="number" min={1} />
          <Champ label="Date" name="date" type="date" defaultValue={cleJour(aujourdhui())} />
          <Champ label="N° de facture ou de reçu" name="justificatif" requis={false} />
          {stockageActif && <Champ label="Photo ou PDF du justificatif" name="fichier" type="file" requis={false} accept="image/*,application/pdf" />}
        </Formulaire>
      )}

      <Section
        titre="Dépenses"
        description={s.role === "CLIENT" ? "Dépenses validées et leurs justificatifs (RG-45)." : `${nAttente} dépense(s) en attente de validation.`}
        actions={
          s.role !== "CLIENT" && (
            <a href={searchParams.filtre === "attente" ? retour : `${retour}?filtre=attente`} className="text-xs font-medium text-indigo-600">
              {searchParams.filtre === "attente" ? "Tout afficher" : "En attente seulement"}
            </a>
          )
        }
      >
        <Tableau entetes={["Date", "Catégorie", "Libellé", "Montant", "Justificatif", "Statut", ""]} vide={!depenses.length}>
          {depenses.map((d) => (
            <tr key={d.id}>
              <td className="whitespace-nowrap">{date(d.date)}</td>
              <td className="text-xs">{CATEGORIES_DEPENSE[d.categorie]}</td>
              <td>{d.libelle}</td>
              <td className="tabular-nums whitespace-nowrap font-medium">{fcfa(d.montant)}</td>
              <td className="text-xs">
                {liens.get(d.id) ? (
                  <a href={liens.get(d.id)!} target="_blank" className="text-indigo-600 underline">
                    Voir le fichier
                  </a>
                ) : (
                  d.justificatif ?? <span className="text-amber-600">non justifiée</span>
                )}
              </td>
              <td>
                <Pastille ton={tonStatut(d.statut)}>{STATUTS_VALIDATION[d.statut]}</Pastille>
                {d.statut === "VALIDEE" && <p className="text-[11px] text-zinc-500 mt-0.5">{d.datePaiement ? `payée le ${date(d.datePaiement)}` : "engagée"}</p>}
              </td>
              <td className="space-x-1 space-y-1 whitespace-nowrap">
                {ouvert && ing && d.statut === "EN_ATTENTE" && (
                  <ActionLigne action={deciderDepense} champs={{ ...cache, id: d.id, decision: "VALIDEE" }} variante="primaire">
                    Valider
                  </ActionLigne>
                )}
                {ouvert && ing && d.statut !== "REJETEE" && !d.datePaiement && (
                  <form action={deciderDepense} className="inline-flex gap-1">
                    {Object.entries({ ...cache, id: d.id, decision: "REJETEE" }).map(([k, v]) => (
                      <input key={k} type="hidden" name={k} value={v} />
                    ))}
                    <input name="motif" required placeholder="motif" className="h-7 w-24 rounded-md border border-input bg-background px-2 text-xs" />
                    <Bouton variante="danger" className="h-7 px-2 text-xs">
                      Rejeter
                    </Bouton>
                  </form>
                )}
                {ouvert && ing && d.statut === "VALIDEE" && !d.datePaiement && (
                  <ActionLigne action={payerDepense} champs={{ ...cache, id: d.id }}>
                    Payée
                  </ActionLigne>
                )}
                {ouvert && s.role !== "CLIENT" && !d.justificatif && !d.fichierCle && d.statut !== "REJETEE" && (
                  <form action={justifierDepense} className="inline-flex gap-1">
                    {Object.entries({ ...cache, id: d.id }).map(([k, v]) => (
                      <input key={k} type="hidden" name={k} value={v} />
                    ))}
                    <input name="justificatif" placeholder="n° de reçu" className="h-7 w-24 rounded-md border border-input bg-background px-2 text-xs" />
                    <Bouton variante="secondaire" className="h-7 px-2 text-xs">
                      Justifier
                    </Bouton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </Tableau>
      </Section>

      {s.role !== "CHEF_CHANTIER" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Section titre="Avances du client" description="Le client déclare son versement ; l'ingénieur confirme sa réception (RG-30).">
            {ouvert && (
              <div className="mb-4">
                <Formulaire action={declarerAvance} titre={ing ? "Enregistrer des fonds reçus" : "Déclarer un versement"} cache={cache}>
                  <Champ label="Montant (FCFA)" name="montant" type="number" min={1} />
                  <Champ label="Date" name="date" type="date" defaultValue={cleJour(aujourdhui())} />
                  <Choix label="Mode" name="mode" options={Object.entries(MODES_PAIEMENT)} />
                  <Champ label="Référence" name="reference" requis={false} />
                </Formulaire>
              </div>
            )}
            <Tableau entetes={["Date", "Montant", "Mode", "Référence", "Statut"]} vide={!avances.length}>
              {avances.map((a) => (
                <tr key={a.id}>
                  <td>{date(a.date)}</td>
                  <td className="tabular-nums font-medium">{fcfa(a.montant)}</td>
                  <td className="text-xs">{MODES_PAIEMENT[a.mode]}</td>
                  <td className="text-xs text-zinc-500">{a.reference}</td>
                  <td className="whitespace-nowrap space-x-1">
                    {ing && ouvert && a.statut === "EN_ATTENTE" ? (
                      <>
                        <ActionLigne action={deciderAvance} champs={{ ...cache, id: a.id, decision: "VALIDEE" }} variante="primaire">
                          Confirmer
                        </ActionLigne>
                        <ActionLigne action={deciderAvance} champs={{ ...cache, id: a.id, decision: "REJETEE", motif: "Fonds non reçus" }} variante="danger">
                          Rejeter
                        </ActionLigne>
                      </>
                    ) : (
                      <Pastille ton={tonStatut(a.statut)}>{STATUTS_VALIDATION[a.statut]}</Pastille>
                    )}
                  </td>
                </tr>
              ))}
            </Tableau>
          </Section>
          <Section titre="Avenants au budget" description="Le budget initial ne change pas ; une révision passe par un avenant (RG-12).">
            {ing && ouvert && (
              <div className="mb-4">
                <Formulaire action={ajouterAvenant} titre="Ajouter un avenant" cache={cache}>
                  <Champ label="Nouveau budget (FCFA)" name="nouveauBudget" type="number" min={1} />
                  <Champ label="Motif" name="motif" />
                </Formulaire>
              </div>
            )}
            <Tableau entetes={["Date", "Nouveau budget", "Motif"]} vide={!avenants.length}>
              {avenants.map((a) => (
                <tr key={a.id}>
                  <td>{date(a.date)}</td>
                  <td className="tabular-nums">{fcfa(a.nouveauBudget)}</td>
                  <td>{a.motif}</td>
                </tr>
              ))}
            </Tableau>
          </Section>
        </div>
      )}
    </div>
  );
}
