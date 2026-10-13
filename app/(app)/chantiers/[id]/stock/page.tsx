import { prisma } from "@/lib/db";
import { exigerChantier } from "@/lib/auth";
import { chargerDonnees } from "@/lib/donnees";
import { calculerIndicateurs } from "@/lib/indicateurs";
import { aujourdhui, cleJour, date, fcfa, nombre, pct } from "@/lib/format";
import { TYPES_MOUVEMENT } from "@/lib/labels";
import { annulerMouvement, creerMateriau, enregistrerMouvement, saisirInventaire, validerInventaire } from "@/app/actions";
import { ActionLigne, Bandeau, Champ, Choix, Formulaire, Note, Pastille, Section, Tableau } from "@/components/app/ui";

export default async function Stock({ params, searchParams }: { params: { id: string }; searchParams: { erreur?: string; ok?: string } }) {
  const { s, chantier } = await exigerChantier(Number(params.id), ["INGENIEUR", "CLIENT", "CHEF_CHANTIER"]);
  const id = chantier.id;
  const retour = `/chantiers/${id}/stock`;
  const cache = { chantierId: id, retour };
  const ind = calculerIndicateurs(await chargerDonnees(id), aujourdhui());
  const [mouvements, inventaires, taches] = await Promise.all([
    prisma.mouvementStock.findMany({ where: { chantierId: id }, include: { materiau: true, tache: true, auteur: true, corrections: true }, orderBy: [{ date: "desc" }, { id: "desc" }], take: 40 }),
    prisma.inventaire.findMany({ where: { chantierId: id }, include: { materiau: true }, orderBy: { date: "desc" }, take: 30 }),
    prisma.tache.findMany({ where: { chantierId: id, statut: { not: "TERMINEE" } }, orderBy: { ordre: "asc" } }),
  ]);
  const saisie = s.role !== "CLIENT" && chantier.statut === "EN_COURS";
  const optMat = ind.materiaux.map((m) => [m.id, `${m.designation} (${m.unite})`] as [number, string]);

  return (
    <div className="space-y-6">
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      <Section titre="Matériaux du chantier" description="Stock théorique = entrées − sorties − pertes − retours ± corrections (RG-22).">
        <Tableau entetes={["Matériau", "Stock", "Reçu", "Consommé", "Pertes", "Taux de perte", "Prix moyen pondéré", "Autonomie", "Dernier inventaire"]} vide={!ind.materiaux.length}>
          {ind.materiaux.map((m) => (
            <tr key={m.id}>
              <td>
                <p className="font-medium">{m.designation}</p>
                <p className="text-xs text-zinc-500">
                  {m.categorie} · livraison {m.delaiLivraisonJours} j · alerte sous {m.seuilAlerteJours} j
                </p>
              </td>
              <td className="tabular-nums whitespace-nowrap font-medium">
                {nombre(m.stock, 2)} {m.unite}
              </td>
              <td className="tabular-nums">{nombre(m.entrees, 1)}</td>
              <td className="tabular-nums">{nombre(m.sorties, 1)}</td>
              <td className="tabular-nums">{nombre(m.pertes, 1)}</td>
              <td className="tabular-nums">{pct(m.tauxPerte)}</td>
              <td className="tabular-nums">{fcfa(m.prixMoyenPondere)}</td>
              <td>
                {Number.isFinite(m.autonomie) ? (
                  <Pastille ton={m.autonomie < m.delaiLivraisonJours ? "rouge" : m.autonomie < m.seuilAlerteJours ? "orange" : "vert"}>{nombre(m.autonomie, 1)} j</Pastille>
                ) : (
                  <span className="text-xs text-zinc-400">non calculable</span>
                )}
              </td>
              <td className="text-xs">
                {m.dernierInventaire ? (
                  <>
                    {date(m.dernierInventaire.date)}
                    <br />
                    <span className={Math.abs(m.ecartInventairePct) > 2 ? "text-amber-600" : "text-zinc-500"}>écart {pct(m.ecartInventairePct)}</span>
                  </>
                ) : (
                  <span className="text-zinc-400">aucun</span>
                )}
              </td>
            </tr>
          ))}
        </Tableau>
        <Note>L&apos;autonomie n&apos;est calculable que si la consommation moyenne des 10 derniers jours ouvrés est positive (§ 4.2 du cahier).</Note>
      </Section>

      {saisie && (
        <div className="space-y-3">
          {s.role === "INGENIEUR" && (
            <Formulaire action={creerMateriau} titre="Enregistrer un matériau à gérer (RG-20)" cache={cache} ouvert={!ind.materiaux.length}>
              <Champ label="Désignation" name="designation" />
              <Champ label="Unité (sac, m³, barre…)" name="unite" />
              <Champ label="Catégorie" name="categorie" placeholder="Liants, Granulats, Aciers…" />
              <Champ label="Prix de référence (FCFA / unité)" name="prixReference" type="number" min={1} />
              <Champ label="Délai de livraison (jours)" name="delaiLivraisonJours" type="number" defaultValue={3} />
              <Champ label="Seuil d'alerte d'autonomie (jours)" name="seuilAlerteJours" type="number" defaultValue={5} />
            </Formulaire>
          )}
          {optMat.length > 0 && (
            <>
              <Formulaire action={enregistrerMouvement} titre="Enregistrer un mouvement de stock (RG-21)" cache={cache}>
                <Choix label="Type" name="type" options={(["ENTREE", "SORTIE", "PERTE", "RETOUR"] as const).map((k) => [k, TYPES_MOUVEMENT[k]])} />
                <Choix label="Matériau" name="materiauId" options={optMat} />
                <Champ label="Quantité" name="quantite" type="number" step="0.01" min="0.01" />
                <Champ label="Date" name="date" type="date" defaultValue={cleJour(aujourdhui())} />
                <Champ label="Prix unitaire (entrée)" name="prixUnitaire" type="number" requis={false} />
                <Choix label="Tâche consommatrice (sortie)" name="tacheId" requis={false} options={taches.map((t) => [t.id, `${t.lot} — ${t.designation}`])} />
                <Champ label="Motif / bon de livraison" name="motif" requis={false} />
              </Formulaire>
              <Formulaire action={saisirInventaire} titre="Saisir l'inventaire hebdomadaire (RG-25)" cache={cache}>
                <Choix label="Matériau" name="materiauId" options={optMat} />
                <Champ label="Stock physique compté" name="stockPhysique" type="number" step="0.01" min="0" />
                <Champ label="Commentaire" name="commentaire" requis={false} />
              </Formulaire>
            </>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Section titre="Inventaires" description="L'ingénieur valide ; la validation aligne le stock théorique par une correction tracée.">
          <Tableau entetes={["Date", "Matériau", "Théorique", "Physique", "Écart", "État"]} vide={!inventaires.length}>
            {inventaires.map((i) => {
              const ecart = i.stockPhysique - i.stockTheorique;
              return (
                <tr key={i.id}>
                  <td>{date(i.date)}</td>
                  <td>{i.materiau.designation}</td>
                  <td className="tabular-nums">{nombre(i.stockTheorique)}</td>
                  <td className="tabular-nums">{nombre(i.stockPhysique)}</td>
                  <td className="tabular-nums">
                    {nombre(ecart)} ({pct(i.stockTheorique ? (ecart / i.stockTheorique) * 100 : NaN)})
                  </td>
                  <td>
                    {i.valide ? (
                      <Pastille ton="vert">Validé</Pastille>
                    ) : s.role === "INGENIEUR" && saisie ? (
                      <ActionLigne action={validerInventaire} champs={{ ...cache, id: i.id }} variante="primaire">
                        Valider
                      </ActionLigne>
                    ) : (
                      <Pastille ton="orange">En attente</Pastille>
                    )}
                  </td>
                </tr>
              );
            })}
          </Tableau>
        </Section>
        <Section titre="Derniers mouvements" description="Rien ne s'efface : une erreur se corrige par une opération opposée (RG-24).">
          <Tableau entetes={["Date", "Type", "Matériau", "Quantité", "Détail", ""]} vide={!mouvements.length}>
            {mouvements.map((m) => (
              <tr key={m.id} className={m.corrections.length ? "opacity-50" : ""}>
                <td className="whitespace-nowrap">{date(m.date)}</td>
                <td>
                  <Pastille ton={m.type === "ENTREE" ? "vert" : m.type === "PERTE" ? "rouge" : m.type === "CORRECTION" ? "indigo" : "gris"}>{TYPES_MOUVEMENT[m.type]}</Pastille>
                </td>
                <td>{m.materiau.designation}</td>
                <td className="tabular-nums whitespace-nowrap">
                  {nombre(m.quantite)} {m.materiau.unite}
                </td>
                <td className="text-xs text-zinc-500">{m.tache?.designation ?? m.motif ?? (m.prixUnitaire ? fcfa(m.prixUnitaire) : "")}</td>
                <td>
                  {saisie && m.type !== "CORRECTION" && !m.corrections.length && (s.role === "INGENIEUR" || (m.auteurId === s.id && cleJour(m.date) === cleJour(aujourdhui()))) && (
                    <ActionLigne action={annulerMouvement} champs={{ ...cache, id: m.id }}>
                      Corriger
                    </ActionLigne>
                  )}
                </td>
              </tr>
            ))}
          </Tableau>
        </Section>
      </div>
    </div>
  );
}
