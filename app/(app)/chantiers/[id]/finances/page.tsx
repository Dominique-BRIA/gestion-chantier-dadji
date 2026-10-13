import { Banknote, FileCheck2, PiggyBank, Receipt } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigerChantier } from "@/lib/auth";
import { chargerDonnees } from "@/lib/donnees";
import { calculerIndicateurs } from "@/lib/indicateurs";
import { lienJustificatif, stockageActif } from "@/lib/fichiers";
import { aujourdhui, cleJour, date, fcfa, pct } from "@/lib/format";
import { CATEGORIES_DEPENSE, MODES_PAIEMENT, STATUTS_VALIDATION } from "@/lib/labels";
import { ajouterAvenant, creerDepense, deciderAvance, deciderDepense, declarerAvance, justifierDepense, payerDepense } from "@/app/actions";
import { ActionLigne, Bandeau, Bouton, Champ, Choix, Formulaire, Note, Pastille, Section, StatCard, Tableau, tonStatut } from "@/components/app/ui";
import { Cadres, type Cadre } from "@/components/app/Cadres";

const mini = "h-8 w-28 rounded-lg border border-input bg-background px-2 text-xs";

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
  const [depenses, avances, avenants, nAttente] = await Promise.all([
    prisma.depense.findMany({ where: { chantierId: id, ...filtre }, orderBy: [{ date: "desc" }, { id: "desc" }], take: 60 }),
    prisma.avance.findMany({ where: { chantierId: id }, orderBy: { date: "desc" } }),
    prisma.avenant.findMany({ where: { chantierId: id }, orderBy: { date: "desc" } }),
    prisma.depense.count({ where: { chantierId: id, statut: "EN_ATTENTE" } }),
  ]);
  const liens = new Map(await Promise.all(depenses.filter((d) => d.fichierCle).map(async (d) => [d.id, await lienJustificatif(d.fichierCle!)] as const)));

  const cadres: Cadre[] = [
    {
      id: "depenses",
      titre: "Dépenses",
      icone: "depense",
      compte: s.role === "CLIENT" ? undefined : nAttente,
      contenu: (
        <Section
          titre="Dépenses"
          description={s.role === "CLIENT" ? "Dépenses validées et leurs justificatifs (RG-45)." : `${nAttente} dépense(s) en attente de validation. Validation automatique jusqu'à ${fcfa(chantier.seuilValidation)} (RG-41).`}
          actions={
            s.role !== "CLIENT" && (
              <a href={searchParams.filtre === "attente" ? retour : `${retour}?filtre=attente`} className="text-xs font-semibold text-primary">
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
                    <a href={liens.get(d.id)!} target="_blank" className="font-medium text-primary underline">
                      Voir le fichier
                    </a>
                  ) : (
                    d.justificatif ?? <Pastille ton="orange">non justifiée</Pastille>
                  )}
                </td>
                <td>
                  <Pastille ton={tonStatut(d.statut)}>{STATUTS_VALIDATION[d.statut]}</Pastille>
                  {d.statut === "VALIDEE" && <p className="mt-0.5 text-[11px] text-muted-foreground">{d.datePaiement ? `payée le ${date(d.datePaiement)}` : "engagée"}</p>}
                </td>
                <td className="whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
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
                        <input name="motif" required placeholder="motif du rejet" className={mini} />
                        <Bouton variante="danger" className="h-8 px-3 text-xs">
                          Rejeter
                        </Bouton>
                      </form>
                    )}
                    {ouvert && ing && d.statut === "VALIDEE" && !d.datePaiement && (
                      <ActionLigne action={payerDepense} champs={{ ...cache, id: d.id }}>
                        Marquer payée
                      </ActionLigne>
                    )}
                    {ouvert && s.role !== "CLIENT" && !d.justificatif && !d.fichierCle && d.statut !== "REJETEE" && (
                      <form action={justifierDepense} className="inline-flex gap-1">
                        {Object.entries({ ...cache, id: d.id }).map(([k, v]) => (
                          <input key={k} type="hidden" name={k} value={v} />
                        ))}
                        <input name="justificatif" placeholder="n° de reçu" className={mini} />
                        <Bouton variante="secondaire" className="h-8 px-3 text-xs">
                          Justifier
                        </Bouton>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Tableau>
        </Section>
      ),
    },
  ];

  if (ouvert && s.role !== "CLIENT") {
    cadres.push({
      id: "nouvelle",
      titre: "Nouvelle dépense",
      icone: "plus",
      contenu: (
        <Formulaire action={creerDepense} titre="Enregistrer une dépense" description={`Validée automatiquement jusqu'à ${fcfa(chantier.seuilValidation)} ; au-delà, l'ingénieur décide (RG-41).`} cache={cache}>
          <Choix label="Catégorie" name="categorie" options={Object.entries(CATEGORIES_DEPENSE)} />
          <Champ label="Libellé" name="libelle" />
          <Champ label="Montant (FCFA)" name="montant" type="number" min={1} />
          <Champ label="Date" name="date" type="date" defaultValue={cleJour(aujourdhui())} />
          <Champ label="N° de facture ou de reçu" name="justificatif" requis={false} />
          {stockageActif && <Champ label="Photo ou PDF du justificatif" name="fichier" type="file" requis={false} accept="image/*,application/pdf" />}
        </Formulaire>
      ),
    });
  }

  if (s.role !== "CHEF_CHANTIER") {
    cadres.push({
      id: "avances",
      titre: "Avances",
      icone: "avances",
      compte: avances.filter((a) => a.statut === "EN_ATTENTE").length,
      contenu: (
        <div className="space-y-5">
          {ouvert && (
            <Formulaire
              action={declarerAvance}
              titre={ing ? "Enregistrer des fonds reçus" : "Déclarer un versement"}
              description={ing ? "Saisie par l'ingénieur : validée d'office." : "L'ingénieur confirmera la réception des fonds (RG-30)."}
              cache={cache}
            >
              <Champ label="Montant (FCFA)" name="montant" type="number" min={1} />
              <Champ label="Date" name="date" type="date" defaultValue={cleJour(aujourdhui())} />
              <Choix label="Mode" name="mode" options={Object.entries(MODES_PAIEMENT)} />
              <Champ label="Référence" name="reference" requis={false} />
            </Formulaire>
          )}
          <Section titre="Avances du client">
            <Tableau entetes={["Date", "Montant", "Mode", "Référence", "Statut"]} vide={!avances.length}>
              {avances.map((a) => (
                <tr key={a.id}>
                  <td>{date(a.date)}</td>
                  <td className="tabular-nums font-medium">{fcfa(a.montant)}</td>
                  <td className="text-xs">{MODES_PAIEMENT[a.mode]}</td>
                  <td className="text-xs text-muted-foreground">{a.reference}</td>
                  <td className="whitespace-nowrap">
                    {ing && ouvert && a.statut === "EN_ATTENTE" ? (
                      <div className="flex gap-1">
                        <ActionLigne action={deciderAvance} champs={{ ...cache, id: a.id, decision: "VALIDEE" }} variante="primaire">
                          Confirmer
                        </ActionLigne>
                        <ActionLigne action={deciderAvance} champs={{ ...cache, id: a.id, decision: "REJETEE", motif: "Fonds non reçus" }} variante="danger">
                          Rejeter
                        </ActionLigne>
                      </div>
                    ) : (
                      <Pastille ton={tonStatut(a.statut)}>{STATUTS_VALIDATION[a.statut]}</Pastille>
                    )}
                  </td>
                </tr>
              ))}
            </Tableau>
          </Section>
        </div>
      ),
    });
    cadres.push({
      id: "avenants",
      titre: "Avenants",
      icone: "budget",
      contenu: (
        <div className="space-y-5">
          {ing && ouvert && (
            <Formulaire action={ajouterAvenant} titre="Réviser le budget" description="Le budget initial ne change pas ; la révision passe par un avenant motivé (RG-12)." cache={cache}>
              <Champ label="Nouveau budget (FCFA)" name="nouveauBudget" type="number" min={1} />
              <Champ label="Motif" name="motif" />
            </Formulaire>
          )}
          <Section titre="Avenants au budget">
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
      ),
    });
  }

  return (
    <div className="space-y-5">
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      {s.role !== "CHEF_CHANTIER" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard titre="Budget restant" valeur={fcfa(f.budgetRestant)} icone={PiggyBank} sousTitre={`${pct(f.consommePct)} de ${fcfa(f.budget)} consommé`} />
            <StatCard titre="Avances validées" valeur={fcfa(f.avancesValidees)} icone={Banknote} couleur="#14b8a6" />
            <StatCard titre="Trésorerie" valeur={fcfa(f.tresorerie)} icone={Receipt} couleur={f.tresorerie < 0 ? "#ef4444" : "#3b82f6"} sousTitre={`Engagé non payé : ${fcfa(f.engagees)}`} />
            <StatCard titre="Justification" valeur={pct(f.tauxJustification)} icone={FileCheck2} couleur="#a855f7" sousTitre="Dépenses justifiées ÷ total" />
          </div>
          <Note>Budget restant = enveloppe non consommée. Trésorerie = avances validées − dépenses payées. Une dépense validée mais non payée est « engagée » (RG-43).</Note>
        </>
      )}
      <Cadres cadres={cadres} />
    </div>
  );
}
