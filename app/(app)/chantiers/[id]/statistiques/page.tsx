import { exigerChantier } from "@/lib/auth";
import { chargerDonnees } from "@/lib/donnees";
import { calculerIndicateurs, N_MIN, type Descriptif } from "@/lib/indicateurs";
import { aujourdhui, date, fcfa, jourCourt, nombre, pct } from "@/lib/format";
import { CATEGORIES_DEPENSE } from "@/lib/labels";
import { Note, Pastille, Section, Tableau } from "@/components/app/ui";
import { Cadres } from "@/components/app/Cadres";
import { Barres, BoiteMoustaches, Courbes, Histogramme, Nuage, Pareto } from "@/components/app/graphiques";

/** Lecture du coefficient de variation (RG-92). */
function lectureCV(cv: number) {
  if (!Number.isFinite(cv)) return <span className="text-xs text-muted-foreground">non calculable</span>;
  if (cv < 15) return <Pastille ton="vert">homogène</Pastille>;
  if (cv <= 30) return <Pastille ton="orange">dispersion modérée</Pastille>;
  return <Pastille ton="rouge">irrégulière</Pastille>;
}

function TableDescriptive({ d, f }: { d: Descriptif; f: (v: number) => string }) {
  const lignes: [string, string, string][] = [
    ["Effectif n", String(d.n), "Nombre de jours observés"],
    ["Moyenne", f(d.moyenne), "Σxᵢ ÷ n"],
    ["Médiane", f(d.mediane), "Valeur centrale, peu sensible aux extrêmes"],
    ["Mode", d.modes.length ? d.modes.map(f).join(" ; ") : "aucun", "Valeur la plus fréquente"],
    ["Écart-type σ", f(d.ecartType), "√(Σ(xᵢ − x̄)² ÷ n)"],
    ["Étendue", f(d.etendue), "max − min"],
    ["Quartiles Q1 / Q3", `${f(d.q1)} / ${f(d.q3)}`, "Méthode tableur (QUARTILE.INCLUS)"],
    ["Intervalle interquartile", f(d.q3 - d.q1), "Q3 − Q1"],
    ["Coefficient de variation", pct(d.cv), "σ ÷ x̄ × 100"],
    ["IC à 95 % de la moyenne", d.ic95 ? `${f(d.ic95.bas)} à ${f(d.ic95.haut)}` : "non calculable", "x̄ ± t(n−1) · s ÷ √n"],
  ];
  return (
    <Tableau entetes={["Statistique", "Valeur", "Formule"]}>
      {lignes.map(([a, b, c]) => (
        <tr key={a}>
          <td className="font-medium">{a}</td>
          <td className="tabular-nums">{b}</td>
          <td className="text-xs text-muted-foreground">{c}</td>
        </tr>
      ))}
    </Tableau>
  );
}

export default async function Statistiques({ params }: { params: { id: string } }) {
  const { chantier } = await exigerChantier(Number(params.id), ["INGENIEUR", "CLIENT"]);
  const ind = calculerIndicateurs(await chargerDonnees(chantier.id), aujourdhui());
  const f = ind.finances;
  const p = ind.productivite;
  const a = ind.avancement;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Période d&apos;analyse : {ind.periode} ({ind.nJoursPeriode} jours ouvrés). Les statistiques ne s&apos;affichent qu&apos;à partir d&apos;un effectif
        minimal : {N_MIN.moyenne} pour une moyenne, {N_MIN.dispersion} pour la dispersion, {N_MIN.boite} pour une boîte à moustaches, {N_MIN.regression} pour une
        régression (RG-91).
      </p>

      <Cadres
        cadres={[
          { id: "descriptif", titre: "Dépenses", icone: "stats", contenu: (
<Section titre="Dépenses journalières : statistique descriptive" description="Jours ouvrés de la période ayant au moins une dépense validée. Unité : FCFA.">
          <TableDescriptive d={f.descriptif} f={fcfa} />
          <div className="mt-3 flex items-center gap-2 text-sm">Lecture du coefficient de variation : {lectureCV(f.descriptif.cv)}</div>
        </Section>
          ) },
          { id: "distribution", titre: "Distribution", icone: "camembert", contenu: (
<div className="space-y-5">
<Section titre="Distribution des dépenses journalières" description="Histogramme en classes d'amplitude égale, règle de Sturges k = 1 + log₂(n).">
            <Histogramme valeurs={f.histogramme} unite="FCFA" />
          </Section>
<Section titre="Boîte à moustaches" description="Les points rouges sont les journées atypiques, au-delà de Q1 − 1,5 × IQR ou Q3 + 1,5 × IQR (Tukey).">
            {f.descriptif.boite ? <BoiteMoustaches boite={f.descriptif.boite} unite="FCFA" /> : <p className="text-sm text-muted-foreground">Données insuffisantes (n &lt; {N_MIN.boite}).</p>}
            {f.descriptif.boite && <Note>{f.descriptif.boite.atypiques.length} journée(s) atypique(s) : à examiner, jamais supprimées du calcul (RG-92).</Note>}
          </Section>
</div>
          ) },
          { id: "regression", titre: "Régression", icone: "comparer", contenu: (
<div className="space-y-5">
<Section
          titre="Heures travaillées et quantité produite"
          description={p.tachePrincipale ? `Tâche la plus observée : « ${p.tachePrincipale} » (${p.unitePrincipale}). Une seule unité d'ouvrage par nuage (RG-94).` : "Aucune production validée sur la période."}
        >
          {p.nuage.length > 0 && <Nuage points={p.nuage} droite={p.regression} xNom="Heures travaillées" yNom={`Quantité (${p.unitePrincipale})`} />}
          {p.regression ? (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Mesure nom="Droite" valeur={`y = ${nombre(p.regression.a, 3)}x ${p.regression.b >= 0 ? "+" : "−"} ${nombre(Math.abs(p.regression.b), 2)}`} />
              <Mesure nom="r (Pearson)" valeur={nombre(p.regression.r, 3)} />
              <Mesure nom="r²" valeur={nombre(p.regression.r2, 3)} />
              <Mesure nom="n" valeur={String(p.regression.n)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Régression non calculée : moins de {N_MIN.regression} observations.</p>
          )}
          <Note>
            La pente a estime la quantité produite par heure supplémentaire. r² indique la part de la variation de la production expliquée par les heures.
            Corrélation effectif / productivité horaire : {nombre(p.correlationEffectif, 3)}. Association statistique, pas forcément une relation de cause à effet.
          </Note>
        </Section>
<Section titre="Productivité horaire par tâche" description="Quantité validée ÷ heures travaillées, sur la période. Comparer seulement des tâches de même unité.">
          <Tableau entetes={["Tâche", "n", "Productivité", "CV", "Régularité"]} vide={!p.parTache.length}>
            {p.parTache.map((t) => (
              <tr key={t.tacheId}>
                <td>{t.designation}</td>
                <td className="tabular-nums">{t.n}</td>
                <td className="tabular-nums whitespace-nowrap">
                  {nombre(t.productiviteHoraire, 3)} {t.unite}/h
                </td>
                <td className="tabular-nums">{pct(t.cv)}</td>
                <td>{lectureCV(t.cv)}</td>
              </tr>
            ))}
          </Tableau>
        </Section>
</div>
          ) },
          { id: "prevision", titre: "Prévision", icone: "tendance", contenu: (
<Section titre="Prévision de la date de fin" description="Régression linéaire de l'avancement validé cumulé sur les jours ouvrés depuis le début.">
        <div className="grid gap-4 sm:grid-cols-4 text-sm mb-4">
          <Mesure nom="Avancement validé" valeur={pct(a.global)} />
          <Mesure nom="Rythme moyen (pente a)" valeur={a.regression ? `${nombre(a.regression.a, 2)} pt / jour` : "—"} />
          <Mesure nom="Ajustement r²" valeur={a.regression ? nombre(a.regression.r2, 3) : "—"} />
          <Mesure nom="Fin estimée" valeur={a.dateFinEstimee ? date(a.dateFinEstimee) : "non fiable"} />
        </div>
        <Courbes
          data={a.serie.map((x) => ({ jour: jourCourt(x.date), reel: +x.reel.toFixed(2), tendance: a.regression ? +Math.min(100, Math.max(0, a.regression.a * a.serie.indexOf(x) + a.regression.b)).toFixed(2) : null }))}
          x="jour"
          series={[
            { cle: "reel", nom: "Avancement cumulé (%)" },
            { cle: "tendance", nom: "Droite de tendance", couleur: "#ef4444", pointille: true },
          ]}
        />
        <Note>
          Hypothèse : {a.fiabiliteFin}. La prévision n&apos;est donnée qu&apos;avec au moins {N_MIN.prevision} jours de production et r² ≥ 0,8.
        </Note>
      </Section>
          ) },
          { id: "abc", titre: "Pareto matériaux", icone: "materiau", contenu: (
<Section titre="Pareto des matériaux consommés (classes ABC)" description="Valeur consommée = sorties × prix moyen pondéré. Classe A jusqu'à 80 % du cumul.">
          <Pareto data={ind.abc.map((l) => ({ nom: l.designation.split(" ")[0], valeur: Math.round(l.valeur), cumul: +l.partCumulee.toFixed(1) }))} />
          <Tableau entetes={["Matériau", "Valeur", "Part", "Cumul", "Classe"]}>
            {ind.abc.map((l) => (
              <tr key={l.designation}>
                <td>{l.designation}</td>
                <td className="tabular-nums">{fcfa(l.valeur)}</td>
                <td className="tabular-nums">{pct(l.part)}</td>
                <td className="tabular-nums">{pct(l.partCumulee)}</td>
                <td>
                  <Pastille ton={l.classe === "A" ? "indigo" : l.classe === "B" ? "orange" : "gris"}>{l.classe}</Pastille>
                </td>
              </tr>
            ))}
          </Tableau>
        </Section>
          ) },
          { id: "categories", titre: "Pareto dépenses", icone: "depense", contenu: (
<Section titre="Pareto des dépenses par catégorie" description="Identifier les postes qui pèsent le plus dans le budget.">
          <Pareto data={f.parCategorie.map((c) => ({ nom: CATEGORIES_DEPENSE[c.categorie as keyof typeof CATEGORIES_DEPENSE], valeur: c.montant, cumul: +c.partCumulee.toFixed(1) }))} />
          <Note>
            Taux de justification : {pct(f.tauxJustification)}. Coût moyen journalier : {fcfa(f.coutMoyenJournalier)}. Écart budgétaire (coût réel − valeur planifiée) :{" "}
            {fcfa(f.ecartBudgetaire)}.
          </Note>
        </Section>
          ) },
          { id: "conso", titre: "Consommation", icone: "stock", contenu: (
<Section titre="Consommation journalière des matériaux" description="Jours de consommation de la période. Taux de perte = pertes ÷ quantités reçues.">
        <Tableau entetes={["Matériau", "n", "Moyenne", "Médiane", "Écart-type", "CV", "Taux de perte", "Prix moyen pondéré", "Variation du prix"]}>
          {ind.materiaux.map((m) => (
            <tr key={m.id}>
              <td className="font-medium">{m.designation}</td>
              <td className="tabular-nums">{m.descriptifConso.n}</td>
              <td className="tabular-nums whitespace-nowrap">
                {nombre(m.descriptifConso.moyenne)} {m.unite}
              </td>
              <td className="tabular-nums">{nombre(m.descriptifConso.mediane)}</td>
              <td className="tabular-nums">{nombre(m.descriptifConso.ecartType)}</td>
              <td>{lectureCV(m.descriptifConso.cv)}</td>
              <td className="tabular-nums">{pct(m.tauxPerte)}</td>
              <td className="tabular-nums">{fcfa(m.prixMoyenPondere)}</td>
              <td className="tabular-nums">{pct(m.variationPrix)}</td>
            </tr>
          ))}
        </Tableau>
      </Section>
          ) },
          { id: "retards", titre: "Retards", icone: "attente", contenu: (
<Section titre="Répartition des retards" description="Jours de retard cumulés par lot et par cause déclarée (RG-55).">
          {a.retardParLot.length ? (
            <>
              <Barres data={a.retardParLot.map((r) => ({ lot: r.lot, jours: r.jours }))} x="lot" series={[{ cle: "jours", nom: "Jours de retard" }]} horizontal hauteur={200} />
              <Tableau entetes={["Cause", "Jours"]}>
                {a.retardParCause.map((r) => (
                  <tr key={r.cause}>
                    <td>{r.cause}</td>
                    <td className="tabular-nums">{r.jours}</td>
                  </tr>
                ))}
              </Tableau>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun retard constaté.</p>
          )}
          <Note>
            {a.nTerminees} tâche(s) terminée(s), dont {pct(a.aTemps)} à temps. Retard moyen des tâches en retard : {nombre(a.retardMoyen, 1)} jour(s).
          </Note>
        </Section>
          ) },
          { id: "presence", titre: "Présence", icone: "presence", contenu: (
<Section titre="Taux de présence journalier" description="Heures réalisées ÷ heures prévues, équipe entière (aucune donnée individuelle).">
          <Courbes data={ind.personnel.seriePresence.map((x) => ({ jour: jourCourt(x.date), taux: +x.taux.toFixed(1) }))} x="jour" series={[{ cle: "taux", nom: "Taux de présence (%)", couleur: "#06b6d4" }]} hauteur={220} />
          <Note>
            Moyenne {pct(ind.personnel.descriptifPresence.moyenne)}, écart-type {nombre(ind.personnel.descriptifPresence.ecartType, 1)} points, n ={" "}
            {ind.personnel.descriptifPresence.n}. Heures supplémentaires : {nombre(ind.personnel.heuresSup, 1)} h.
          </Note>
        </Section>
          ) },
        ]}
      />
    </div>
  );
}

function Mesure({ nom, valeur }: { nom: string; valeur: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">{nom}</p>
      <p className="font-semibold tabular-nums">{valeur}</p>
    </div>
  );
}
