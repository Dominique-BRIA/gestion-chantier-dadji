import { AlertTriangle, Banknote, CalendarClock, Gauge, Package, Users, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigerChantier } from "@/lib/auth";
import { chargerDonnees } from "@/lib/donnees";
import { calculerIndicateurs } from "@/lib/indicateurs";
import { aujourdhui, date, fcfa, jourCourt, nombre, pct } from "@/lib/format";
import { CATEGORIES_DEPENSE, STATUTS_PRESENCE, STATUTS_TACHE, TYPES_SIGNALEMENT } from "@/lib/labels";
import { creerSignalement, declarerFinTache, pointer } from "@/app/actions";
import { Bandeau, Bouton, Choix, Formulaire, Mesure, Note, Pastille, Section, StatCard, Tableau, Zone, tonStatut } from "@/components/app/ui";
import { Cadres } from "@/components/app/Cadres";
import { Camembert, Courbes } from "@/components/app/graphiques";
import { cn } from "@/lib/utils";

type Params = { params: { id: string }; searchParams: { erreur?: string; ok?: string } };

export default async function TableauDeBord({ params, searchParams }: Params) {
  const { s, chantier } = await exigerChantier(Number(params.id));
  if (s.role === "MANOEUVRE") return <EspaceManoeuvre id={chantier.id} ouvrierId={s.id} searchParams={searchParams} />;

  const ind = calculerIndicateurs(await chargerDonnees(chantier.id), aujourdhui());
  const f = ind.finances;
  const a = ind.avancement;
  const pj = ind.personnel.presenceDuJour;
  const critiques = ind.alertes.filter((x) => x.niveau === "critique").length;

  return (
    <div className="space-y-5">
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard titre="Budget consommé" valeur={pct(f.consommePct)} icone={Wallet} sousTitre={`${fcfa(f.consomme)} sur ${fcfa(f.budget)}`} />
        <StatCard
          titre="Trésorerie disponible"
          valeur={fcfa(f.tresorerie)}
          icone={Banknote}
          couleur={f.tresorerie < 0 ? "#ef4444" : "#14b8a6"}
          sousTitre={Number.isFinite(f.joursTresorerie) ? `Environ ${nombre(f.joursTresorerie, 1)} jours au rythme actuel` : "Avances validées − dépenses payées"}
        />
        <StatCard titre="Avancement validé" valeur={pct(a.global)} icone={Gauge} couleur="#3b82f6" sousTitre={`Prévu à ce jour : ${pct(a.prevu)}`} />
        <StatCard
          titre="Présence du jour"
          valeur={pj ? `${pj.presents} / ${pj.total}` : "Non saisie"}
          icone={Users}
          couleur="#a855f7"
          sousTitre={pj ? `${pct((pj.realisees / pj.prevues) * 100)} des heures prévues` : "Aucune présence saisie aujourd'hui"}
        />
      </div>

      <Cadres
        cadres={[
          {
            id: "alertes",
            titre: "Alertes",
            icone: "alertes",
            compte: ind.alertes.length,
            contenu: (
              <Section titre="Alertes décisionnelles" description={`${ind.alertes.length} alerte(s), dont ${critiques} critique(s). Une alerte est un signal à examiner, pas une preuve de faute.`}>
                {ind.alertes.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Aucune alerte : tous les indicateurs sont dans leurs seuils.</p>}
                <div className="grid gap-3 lg:grid-cols-2">
                  {ind.alertes.map((al, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-xl border p-4",
                        al.niveau === "critique" ? "border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/30" : "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className={cn("h-5 w-5 shrink-0 mt-0.5", al.niveau === "critique" ? "text-red-500" : "text-amber-500")} />
                        <div className="space-y-1.5 text-sm min-w-0">
                          <p className="font-semibold">
                            <span className="mr-1.5 font-mono text-xs text-muted-foreground">{al.code}</span>
                            {al.titre}
                          </p>
                          <p className="text-foreground/80">{al.message}</p>
                          <p className="text-xs text-muted-foreground">
                            <b>Règle :</b> {al.regle} · <b>Période :</b> {al.periode}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <b>Décision :</b> {al.decision} · <b>Traité par :</b> {al.responsable}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ),
          },
          {
            id: "avancement",
            titre: "Avancement",
            icone: "tendance",
            contenu: (
              <Section titre="Avancement réel et prévu" description="Courbe en S : avancement validé cumulé, pondéré par le coût des tâches (RG-55).">
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                  <Mesure nom="Indice de délai (SPI)" valeur={nombre(a.spi, 2)} />
                  <Mesure nom="Indice de coût (CPI)" valeur={nombre(a.cpi, 2)} />
                  <Mesure nom="Fin prévue" valeur={date(chantier.dateFinPrevue)} />
                  <Mesure nom="Fin estimée" valeur={a.dateFinEstimee ? date(a.dateFinEstimee) : "non fiable"} />
                </div>
                <Courbes
                  data={a.serie.map((p) => ({ jour: jourCourt(p.date), reel: +p.reel.toFixed(1), prevu: +p.prevu.toFixed(1) }))}
                  x="jour"
                  hauteur={300}
                  series={[
                    { cle: "reel", nom: "Réel validé (%)" },
                    { cle: "prevu", nom: "Prévu (%)", couleur: "#94a3b8", pointille: true },
                  ]}
                />
                <Note>
                  SPI = valeur acquise ÷ valeur planifiée ; CPI = valeur acquise ÷ coût réel. Sous 1, le chantier est en retard ou coûte plus que prévu. Fin
                  estimée : {a.fiabiliteFin}.
                </Note>
              </Section>
            ),
          },
          {
            id: "depenses",
            titre: "Dépenses",
            icone: "courbe",
            contenu: (
              <Section titre="Dépenses journalières" description="Dépenses validées par jour et moyenne mobile sur 7 jours.">
                <Courbes
                  data={f.serieDepenses.map((p) => ({ jour: jourCourt(p.date), montant: p.montant, mm: p.moyenneMobile && Math.round(p.moyenneMobile) }))}
                  x="jour"
                  hauteur={320}
                  series={[
                    { cle: "montant", nom: "Dépenses (FCFA)" },
                    { cle: "mm", nom: "Moyenne mobile 7 j", couleur: "#14b8a6" },
                  ]}
                />
                <Note>
                  Période {ind.periode}, {ind.nJoursPeriode} jours ouvrés. Un pic n&apos;est pas une anomalie en soi : achats anticipés et paie du samedi en créent.
                </Note>
              </Section>
            ),
          },
          {
            id: "repartition",
            titre: "Répartition",
            icone: "camembert",
            contenu: (
              <Section titre="Répartition des dépenses" description="Part de chaque catégorie dans les dépenses validées.">
                <Camembert hauteur={320} data={f.parCategorie.map((c) => ({ nom: CATEGORIES_DEPENSE[c.categorie as keyof typeof CATEGORIES_DEPENSE], valeur: c.montant }))} />
              </Section>
            ),
          },
          {
            id: "stock",
            titre: "Stock",
            icone: "materiau",
            contenu: (
              <Section titre="Stock et autonomie" description="Autonomie = stock ÷ consommation moyenne des 10 derniers jours ouvrés.">
                <Tableau entetes={["Matériau", "Stock", "Autonomie", "Délai de livraison"]} vide={!ind.materiaux.length}>
                  {ind.materiaux.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <span className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          {m.designation}
                        </span>
                      </td>
                      <td className="tabular-nums">
                        {nombre(m.stock, 1)} {m.unite}
                      </td>
                      <td>
                        {Number.isFinite(m.autonomie) ? (
                          <Pastille ton={m.autonomie < m.delaiLivraisonJours ? "rouge" : m.autonomie < m.seuilAlerteJours ? "orange" : "vert"}>{nombre(m.autonomie, 1)} jours</Pastille>
                        ) : (
                          <span className="text-xs text-muted-foreground">non calculable</span>
                        )}
                      </td>
                      <td className="tabular-nums text-muted-foreground">{m.delaiLivraisonJours} jours</td>
                    </tr>
                  ))}
                </Tableau>
              </Section>
            ),
          },
        ]}
      />
    </div>
  );
}

/** RG-05 et RG-06 : le manœuvre ne voit que ses présences, les tâches en cours et ses signalements. */
async function EspaceManoeuvre({ id, ouvrierId, searchParams }: { id: number; ouvrierId: number; searchParams: Params["searchParams"] }) {
  const [presences, taches, signalements] = await Promise.all([
    prisma.presence.findMany({ where: { ouvrierId, chantierId: id }, orderBy: { date: "desc" }, take: 30 }),
    prisma.tache.findMany({ where: { chantierId: id, statut: "EN_COURS" }, orderBy: { ordre: "asc" } }),
    prisma.signalement.findMany({ where: { chantierId: id, auteurId: ouvrierId }, orderBy: { date: "desc" } }),
  ]);
  const auj = aujourdhui();
  const pointe = presences.some((p) => +p.date === +auj);
  const heures = presences.reduce((x, p) => x + p.heuresRealisees, 0);
  const prevues = presences.reduce((x, p) => x + p.heuresPrevues, 0);
  const retour = `/chantiers/${id}`;
  return (
    <div className="space-y-5">
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard titre="Mon taux de présence" valeur={pct(prevues ? (heures / prevues) * 100 : NaN)} icone={Users} sousTitre={`${presences.length} derniers jours saisis`} />
        <StatCard titre="Heures réalisées" valeur={`${nombre(heures, 1)} h`} icone={CalendarClock} couleur="#14b8a6" />
      </div>
      <Cadres
        cadres={[
          {
            id: "pointage",
            titre: "Aujourd'hui",
            icone: "pointage",
            contenu: (
              <Section titre="Pointage du jour" description="Votre pointage est confirmé ensuite par le chef de chantier (RG-61).">
                {pointe ? (
                  <Pastille ton="vert">Votre présence du jour est enregistrée</Pastille>
                ) : (
                  <form action={pointer}>
                    <input type="hidden" name="chantierId" value={id} />
                    <input type="hidden" name="retour" value={retour} />
                    <Bouton>Je suis arrivé</Bouton>
                  </form>
                )}
              </Section>
            ),
          },
          {
            id: "taches",
            titre: "Tâches en cours",
            icone: "taches",
            compte: taches.length,
            contenu: (
              <Section titre="Tâches en cours" description="Signalez la fin d'une tâche : le chef de chantier la confirmera (RG-52).">
                <Tableau entetes={["Lot", "Tâche", "Statut", ""]} vide={!taches.length}>
                  {taches.map((t) => (
                    <tr key={t.id}>
                      <td className="text-muted-foreground">{t.lot}</td>
                      <td>{t.designation}</td>
                      <td>
                        <Pastille ton={tonStatut(t.statut)}>{t.finDeclareeLe ? "Fin signalée" : STATUTS_TACHE[t.statut]}</Pastille>
                      </td>
                      <td className="text-right">
                        {!t.finDeclareeLe && (
                          <form action={declarerFinTache}>
                            <input type="hidden" name="chantierId" value={id} />
                            <input type="hidden" name="tacheId" value={t.id} />
                            <input type="hidden" name="retour" value={retour} />
                            <Bouton variante="secondaire" className="h-8 text-xs">
                              Signaler la fin
                            </Bouton>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </Tableau>
              </Section>
            ),
          },
          {
            id: "presences",
            titre: "Mes présences",
            icone: "presence",
            contenu: (
              <Section titre="Mes présences">
                <Tableau entetes={["Date", "Statut", "Heures", ""]} vide={!presences.length}>
                  {presences.map((p) => (
                    <tr key={p.id}>
                      <td>{date(p.date)}</td>
                      <td>
                        <Pastille ton={tonStatut(p.statut)}>{STATUTS_PRESENCE[p.statut]}</Pastille>
                      </td>
                      <td className="tabular-nums">{p.heuresRealisees} h</td>
                      <td className="text-xs text-muted-foreground">{p.confirmee ? "" : "à confirmer"}</td>
                    </tr>
                  ))}
                </Tableau>
              </Section>
            ),
          },
          {
            id: "signaler",
            titre: "Signaler",
            icone: "signalement",
            compte: signalements.filter((x) => x.statut !== "CLOS").length,
            contenu: (
              <div className="space-y-5">
                <Formulaire action={creerSignalement} titre="Signaler un manque, une perte ou un incident" cache={{ chantierId: id, retour }} bouton="Envoyer">
                  <Choix label="Type" name="type" options={(["MANQUE_MATERIAU", "PERTE", "INCIDENT"] as const).map((k) => [k, TYPES_SIGNALEMENT[k]])} />
                  <Zone label="Description" name="description" large />
                </Formulaire>
                <Section titre="Mes signalements">
                  <Tableau entetes={["Date", "Type", "Statut", "Réponse"]} vide={!signalements.length}>
                    {signalements.map((x) => (
                      <tr key={x.id}>
                        <td>{date(x.date)}</td>
                        <td>{TYPES_SIGNALEMENT[x.type]}</td>
                        <td>
                          <Pastille ton={tonStatut(x.statut)}>{x.statut === "CLOS" ? "Clos" : x.statut === "EN_COURS" ? "En cours" : "Ouvert"}</Pastille>
                        </td>
                        <td className="text-xs text-muted-foreground">{x.reponse ?? "—"}</td>
                      </tr>
                    ))}
                  </Tableau>
                </Section>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
