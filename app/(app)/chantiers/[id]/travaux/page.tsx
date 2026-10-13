import { prisma } from "@/lib/db";
import { exigerChantier } from "@/lib/auth";
import { chargerDonnees } from "@/lib/donnees";
import { calculerIndicateurs } from "@/lib/indicateurs";
import { aujourdhui, cleJour, date, fcfa, nombre, pct } from "@/lib/format";
import { CAUSES_RETARD, LOTS_PAR_TYPE, STATUTS_TACHE } from "@/lib/labels";
import { cloturerTache, confirmerFinTache, creerTache, deciderProduction, declarerProduction } from "@/app/actions";
import { ActionLigne, Bandeau, Bouton, Champ, Choix, Formulaire, Note, Pastille, Section, Tableau, tonStatut } from "@/components/app/ui";
import { Cadres, type Cadre } from "@/components/app/Cadres";

export default async function Travaux({ params, searchParams }: { params: { id: string }; searchParams: { erreur?: string; ok?: string } }) {
  const { s, chantier } = await exigerChantier(Number(params.id), ["INGENIEUR", "CLIENT", "CHEF_CHANTIER"]);
  const id = chantier.id;
  const retour = `/chantiers/${id}/travaux`;
  const cache = { chantierId: id, retour };
  const ouvert = chantier.statut === "EN_COURS";
  const ind = calculerIndicateurs(await chargerDonnees(id), aujourdhui());
  const enAttente = await prisma.production.findMany({
    where: { tache: { chantierId: id }, statut: "EN_ATTENTE" },
    include: { tache: true, declarePar: true },
    orderBy: { date: "desc" },
  });
  const taches = ind.avancement.taches;
  const lots = Array.from(new Set([...LOTS_PAR_TYPE[chantier.type], ...taches.map((t) => t.lot)]));
  const meta = await prisma.tache.findMany({ where: { chantierId: id }, select: { id: true, finDeclareeLe: true, finConfirmee: true } });
  const fin = new Map(meta.map((m) => [m.id, m]));

  const cadres: Cadre[] = [
    { id: "taches", titre: "Tâches", icone: "taches", contenu: (
<Section
        titre="Tâches et avancement"
        description={`Avancement global pondéré par le coût prévu : ${pct(ind.avancement.global)} (prévu à ce jour : ${pct(ind.avancement.prevu)}). Seules les productions validées comptent (RG-53).`}
      >
        <Tableau entetes={["Lot", "Tâche", "Réalisé / prévu", "Réalisation", "Coût prévu", "Fin prévue", "Retard", "Statut", ""]} vide={!taches.length}>
          {taches.map((t) => {
            const m = fin.get(t.id);
            return (
              <tr key={t.id}>
                <td className="text-xs text-muted-foreground whitespace-nowrap">{t.lot}</td>
                <td>{t.designation}</td>
                <td className="tabular-nums whitespace-nowrap">
                  {nombre(t.realise, 1)} / {nombre(t.quantitePrevue, 1)} {t.unite}
                </td>
                <td className="min-w-[110px]">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${t.taux}%` }} />
                    </div>
                    <span className="text-xs tabular-nums">{nombre(t.taux, 0)} %</span>
                  </div>
                  {t.depassement && <p className="text-[11px] text-amber-600">Quantité dépassée : revoir le métré</p>}
                </td>
                <td className="tabular-nums whitespace-nowrap">{fcfa(t.coutPrevu)}</td>
                <td className="whitespace-nowrap">{date(t.dateFinPrevue)}</td>
                <td className="whitespace-nowrap">
                  {t.retard > 0 ? <Pastille ton="rouge">{t.retard} j</Pastille> : <span className="text-xs text-muted-foreground">—</span>}
                  {t.causeRetard && <p className="text-[11px] text-muted-foreground">{t.causeRetard}</p>}
                </td>
                <td>
                  <Pastille ton={tonStatut(t.statut)}>{STATUTS_TACHE[t.statut]}</Pastille>
                  {m?.finDeclareeLe && t.statut !== "TERMINEE" && <p className="text-[11px] text-muted-foreground">{m.finConfirmee ? "fin confirmée" : "fin signalée"}</p>}
                </td>
                <td className="whitespace-nowrap">
                  {ouvert && s.role === "CHEF_CHANTIER" && m?.finDeclareeLe && !m.finConfirmee && (
                    <ActionLigne action={confirmerFinTache} champs={{ ...cache, tacheId: t.id }} variante="primaire">
                      Confirmer la fin
                    </ActionLigne>
                  )}
                  {ouvert && s.role === "INGENIEUR" && t.statut === "EN_COURS" && (
                    <form action={cloturerTache} className="inline-flex gap-1">
                      {Object.entries({ ...cache, tacheId: t.id, dateFinReelle: cleJour(aujourdhui()) }).map(([k, v]) => (
                        <input key={k} type="hidden" name={k} value={v} />
                      ))}
                      {aujourdhui() > t.dateFinPrevue && (
                        <select name="causeRetard" required className="h-7 rounded-md border border-input bg-background px-1 text-xs">
                          <option value="">cause du retard</option>
                          {CAUSES_RETARD.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      )}
                      <Bouton variante="secondaire" className="h-7 px-2 text-xs">
                        Clôturer
                      </Bouton>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </Tableau>
        <Note>
          Taux de réalisation = min(100 %, quantité validée ÷ quantité prévue). Avancement global = Σ (tauxᵢ × coûtᵢ) ÷ Σ coûtᵢ : une moyenne simple des
          pourcentages est exclue (§ 4.4 du cahier).
        </Note>
      </Section>
    ) },
  ];
  if (ouvert && s.role !== "CLIENT") cadres.push({ id: "production", titre: "Production du jour", icone: "plus", contenu: (
<Formulaire action={declarerProduction} titre="Déclarer la production du jour" description="Quantité, heures et effectif : la déclaration attend la validation de l'ingénieur (RG-51, RG-53)." cache={cache}>
            <Choix label="Tâche" name="tacheId" options={taches.filter((t) => t.statut !== "TERMINEE").map((t) => [t.id, `${t.designation} (${t.unite})`])} />
            <Champ label="Date" name="date" type="date" defaultValue={cleJour(aujourdhui())} />
            <Champ label="Quantité réalisée" name="quantite" type="number" step="0.01" min="0.01" />
            <Champ label="Heures travaillées (équipe)" name="heuresTravaillees" type="number" step="0.5" min="0.5" />
            <Champ label="Effectif" name="effectif" type="number" min={1} defaultValue={1} />
          </Formulaire>
  ) });
  cadres.push({ id: "attente", titre: "En attente", icone: "attente", compte: enAttente.length, contenu: (
<Section
        titre="Productions en attente de validation"
        description="L'ingénieur valide après contrôle sur le terrain ; au-delà de 3 jours, l'alerte AL-08 se déclenche."
        actions={
          s.role === "INGENIEUR" &&
          ouvert &&
          enAttente.length > 0 && (
            <ActionLigne action={deciderProduction} champs={{ ...cache, decision: "VALIDEE" }} variante="primaire">
              Tout valider ({enAttente.length})
            </ActionLigne>
          )
        }
      >
        <Tableau entetes={["Date", "Tâche", "Quantité", "Heures", "Effectif", "Productivité", "Déclaré par", ""]} vide={!enAttente.length}>
          {enAttente.map((p) => (
            <tr key={p.id}>
              <td>{date(p.date)}</td>
              <td>{p.tache.designation}</td>
              <td className="tabular-nums">
                {nombre(p.quantite)} {p.tache.unite}
              </td>
              <td className="tabular-nums">{p.heuresTravaillees} h</td>
              <td className="tabular-nums">{p.effectif}</td>
              <td className="tabular-nums text-xs">
                {nombre(p.quantite / p.heuresTravaillees, 3)} {p.tache.unite}/h
              </td>
              <td className="text-xs">
                {p.declarePar.prenom} {p.declarePar.nom}
              </td>
              <td className="whitespace-nowrap space-x-1">
                {s.role === "INGENIEUR" && ouvert && (
                  <>
                    <ActionLigne action={deciderProduction} champs={{ ...cache, id: p.id, decision: "VALIDEE" }} variante="primaire">
                      Valider
                    </ActionLigne>
                    <ActionLigne action={deciderProduction} champs={{ ...cache, id: p.id, decision: "REJETEE", motif: "Quantité non constatée" }} variante="danger">
                      Rejeter
                    </ActionLigne>
                  </>
                )}
              </td>
            </tr>
          ))}
        </Tableau>
      </Section>
  ) });
  if (ouvert && s.role === "INGENIEUR") cadres.push({ id: "nouvelle", titre: "Nouvelle tâche", icone: "ajout", contenu: (
<Formulaire action={creerTache} titre="Créer une tâche" description="Le coût prévu sert de poids dans l'avancement global (RG-50, RG-55)." cache={cache}>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Lot</span>
                <input name="lot" list="lots" required className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" />
                <datalist id="lots">
                  {lots.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </label>
              <Champ label="Désignation" name="designation" />
              <Champ label="Unité d'ouvrage (m², m³, ml…)" name="unite" />
              <Champ label="Quantité prévue" name="quantitePrevue" type="number" step="0.01" min="0.01" />
              <Champ label="Coût prévu (FCFA)" name="coutPrevu" type="number" min={1} />
              <Champ label="Début prévu" name="dateDebutPrevue" type="date" />
              <Champ label="Fin prévue" name="dateFinPrevue" type="date" />
            </Formulaire>
  ) });

  return (
    <div className="space-y-5">
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      <Cadres cadres={cadres} />
    </div>
  );
}
