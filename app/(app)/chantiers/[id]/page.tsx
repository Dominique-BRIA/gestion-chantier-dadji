import { AlertTriangle, Banknote, CalendarClock, Gauge, Hammer, Package, Users, Wallet } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigerChantier } from "@/lib/auth";
import { chargerDonnees } from "@/lib/donnees";
import { calculerIndicateurs } from "@/lib/indicateurs";
import { aujourdhui, date, fcfa, jourCourt, nombre, pct } from "@/lib/format";
import { CATEGORIES_DEPENSE, STATUTS_PRESENCE, STATUTS_TACHE, TYPES_SIGNALEMENT } from "@/lib/labels";
import { creerSignalement, declarerFinTache, pointer } from "@/app/actions";
import { Bandeau, Bouton, Choix, Formulaire, Note, Pastille, Section, StatCard, Tableau, tonStatut } from "@/components/app/ui";
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

  return (
    <div className="space-y-6">
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard titre="Budget consommé" valeur={pct(f.consommePct)} icone={Wallet} sousTitre={`${fcfa(f.consomme)} sur ${fcfa(f.budget)}`} />
        <StatCard
          titre="Trésorerie disponible"
          valeur={fcfa(f.tresorerie)}
          icone={Banknote}
          couleur={f.tresorerie < 0 ? "#ef4444" : "#10b981"}
          sousTitre={Number.isFinite(f.joursTresorerie) ? `≈ ${nombre(f.joursTresorerie, 1)} jours au rythme actuel` : "Avances validées − dépenses payées"}
        />
        <StatCard titre="Avancement validé" valeur={pct(a.global)} icone={Gauge} couleur="#8b5cf6" sousTitre={`Prévu à ce jour : ${pct(a.prevu)}`} />
        <StatCard
          titre="Présence du jour"
          valeur={pj ? `${pj.presents} / ${pj.total}` : "Non saisie"}
          icone={Users}
          couleur="#06b6d4"
          sousTitre={pj ? `${pct((pj.realisees / pj.prevues) * 100)} des heures prévues` : "Aucune présence saisie aujourd'hui"}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard titre="Indice de délai (SPI)" valeur={nombre(a.spi, 2)} icone={CalendarClock} couleur={a.spi < 0.9 ? "#f59e0b" : "#10b981"} sousTitre="Valeur acquise ÷ valeur planifiée" />
        <StatCard titre="Indice de coût (CPI)" valeur={nombre(a.cpi, 2)} icone={Hammer} couleur={a.cpi < 0.9 ? "#f59e0b" : "#10b981"} sousTitre="Valeur acquise ÷ coût réel" />
        <StatCard titre="Fin estimée" valeur={a.dateFinEstimee ? date(a.dateFinEstimee) : "Non fiable"} icone={CalendarClock} couleur="#ec4899" sousTitre={`Prévue le ${date(chantier.dateFinPrevue)}`} />
        <StatCard titre="Alertes actives" valeur={String(ind.alertes.length)} icone={AlertTriangle} couleur={ind.alertes.some((x) => x.niveau === "critique") ? "#ef4444" : "#f59e0b"} sousTitre={`${ind.alertes.filter((x) => x.niveau === "critique").length} critique(s)`} />
      </div>

      {ind.alertes.length > 0 && (
        <Section titre="Alertes décisionnelles" description="Une alerte est un signal à examiner, pas une preuve de faute (§ 8 du cahier).">
          <div className="grid gap-3 lg:grid-cols-2">
            {ind.alertes.map((al, i) => (
              <div key={i} className={cn("rounded-xl border p-4", al.niveau === "critique" ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20" : "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20")}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn("h-5 w-5 shrink-0 mt-0.5", al.niveau === "critique" ? "text-red-500" : "text-amber-500")} />
                  <div className="space-y-1 text-sm min-w-0">
                    <p className="font-semibold">
                      <span className="text-xs font-mono text-zinc-400 mr-1.5">{al.code}</span>
                      {al.titre}
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-300">{al.message}</p>
                    <p className="text-xs text-zinc-500">
                      <b>Règle :</b> {al.regle} · <b>Période :</b> {al.periode}
                    </p>
                    <p className="text-xs text-zinc-500">
                      <b>Décision suggérée :</b> {al.decision} · <b>Traité par :</b> {al.responsable}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section titre="Avancement réel et prévu" description="Courbe en S : avancement validé cumulé, pondéré par le coût des tâches (RG-55).">
          <Courbes
            data={a.serie.map((p) => ({ jour: jourCourt(p.date), reel: +p.reel.toFixed(1), prevu: +p.prevu.toFixed(1) }))}
            x="jour"
            series={[
              { cle: "reel", nom: "Réel validé (%)" },
              { cle: "prevu", nom: "Prévu (%)", couleur: "#a1a1aa", pointille: true },
            ]}
          />
          <Note>
            Date de fin estimée {a.dateFinEstimee ? `le ${date(a.dateFinEstimee)}` : "non calculable"} — {a.fiabiliteFin}.
          </Note>
        </Section>
        <Section titre="Dépenses journalières" description="Dépenses validées par jour et moyenne mobile sur 7 jours.">
          <Courbes
            data={f.serieDepenses.map((p) => ({ jour: jourCourt(p.date), montant: p.montant, mm: p.moyenneMobile && Math.round(p.moyenneMobile) }))}
            x="jour"
            series={[
              { cle: "montant", nom: "Dépenses (FCFA)" },
              { cle: "mm", nom: "Moyenne mobile 7 j", couleur: "#f59e0b" },
            ]}
          />
          <Note>
            Période {ind.periode}, {ind.nJoursPeriode} jours ouvrés. Une hausse n&apos;est pas une anomalie en soi : achats anticipés et paiements groupés
            (paie du samedi) créent des pics.
          </Note>
        </Section>
        <Section titre="Répartition des dépenses" description="Part de chaque catégorie dans les dépenses validées.">
          <Camembert data={f.parCategorie.map((c) => ({ nom: CATEGORIES_DEPENSE[c.categorie as keyof typeof CATEGORIES_DEPENSE], valeur: c.montant }))} />
        </Section>
        <Section titre="Stock et autonomie" description="Autonomie = stock ÷ consommation moyenne des 10 derniers jours ouvrés.">
          <Tableau entetes={["Matériau", "Stock", "Autonomie", "Délai"]} vide={!ind.materiaux.length}>
            {ind.materiaux.map((m) => (
              <tr key={m.id}>
                <td className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-zinc-400" />
                  {m.designation}
                </td>
                <td className="tabular-nums">
                  {nombre(m.stock, 1)} {m.unite}
                </td>
                <td>
                  {Number.isFinite(m.autonomie) ? (
                    <Pastille ton={m.autonomie < m.delaiLivraisonJours ? "rouge" : m.autonomie < m.seuilAlerteJours ? "orange" : "vert"}>{nombre(m.autonomie, 1)} j</Pastille>
                  ) : (
                    <span className="text-xs text-zinc-400">non calculable</span>
                  )}
                </td>
                <td className="tabular-nums text-zinc-500">{m.delaiLivraisonJours} j</td>
              </tr>
            ))}
          </Tableau>
        </Section>
      </div>
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
  const heures = presences.reduce((s, p) => s + p.heuresRealisees, 0);
  const prevues = presences.reduce((s, p) => s + p.heuresPrevues, 0);
  const retour = `/chantiers/${id}`;
  return (
    <div className="space-y-6">
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard titre="Mon taux de présence" valeur={pct(prevues ? (heures / prevues) * 100 : NaN)} icone={Users} sousTitre={`${presences.length} derniers jours saisis`} />
        <StatCard titre="Heures réalisées" valeur={`${nombre(heures, 1)} h`} icone={CalendarClock} couleur="#06b6d4" />
        <Section titre="Pointage du jour">
          {pointe ? (
            <p className="text-sm text-emerald-600">Votre présence du jour est enregistrée.</p>
          ) : (
            <form action={pointer}>
              <input type="hidden" name="chantierId" value={id} />
              <input type="hidden" name="retour" value={retour} />
              <Bouton>Je suis arrivé</Bouton>
            </form>
          )}
        </Section>
      </div>
      <Section titre="Tâches en cours" description="Signalez la fin d'une tâche : le chef de chantier la confirmera (RG-52).">
        <Tableau entetes={["Lot", "Tâche", "Statut", ""]} vide={!taches.length}>
          {taches.map((t) => (
            <tr key={t.id}>
              <td className="text-zinc-500">{t.lot}</td>
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
                    <Bouton variante="secondaire" className="h-7 text-xs">
                      Signaler la fin
                    </Bouton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </Tableau>
      </Section>
      <Formulaire action={creerSignalement} titre="Signaler un manque, une perte ou un incident" cache={{ chantierId: id, retour }} bouton="Envoyer">
        <Choix label="Type" name="type" options={(["MANQUE_MATERIAU", "PERTE", "INCIDENT"] as const).map((k) => [k, TYPES_SIGNALEMENT[k]])} />
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="font-medium">Description</span>
          <textarea name="description" required rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
        </label>
      </Formulaire>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section titre="Mes présences">
          <Tableau entetes={["Date", "Statut", "Heures", ""]} vide={!presences.length}>
            {presences.map((p) => (
              <tr key={p.id}>
                <td>{date(p.date)}</td>
                <td>
                  <Pastille ton={tonStatut(p.statut)}>{STATUTS_PRESENCE[p.statut]}</Pastille>
                </td>
                <td className="tabular-nums">{p.heuresRealisees} h</td>
                <td className="text-xs text-zinc-400">{p.confirmee ? "" : "à confirmer"}</td>
              </tr>
            ))}
          </Tableau>
        </Section>
        <Section titre="Mes signalements">
          <Tableau entetes={["Date", "Type", "Statut", "Réponse"]} vide={!signalements.length}>
            {signalements.map((x) => (
              <tr key={x.id}>
                <td>{date(x.date)}</td>
                <td>{TYPES_SIGNALEMENT[x.type]}</td>
                <td>
                  <Pastille ton={tonStatut(x.statut)}>{x.statut === "CLOS" ? "Clos" : x.statut === "EN_COURS" ? "En cours" : "Ouvert"}</Pastille>
                </td>
                <td className="text-xs text-zinc-500">{x.reponse ?? "—"}</td>
              </tr>
            ))}
          </Tableau>
        </Section>
      </div>
    </div>
  );
}
