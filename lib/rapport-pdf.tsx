/**
 * Rapport de chantier au format PDF (module 9 du cahier : rapports et export).
 *
 * Mise en page avec @react-pdf/renderer, police Helvetica intégrée au PDF :
 * elle ne connaît que le jeu de caractères Windows-1252, d'où le nettoyage
 * des espaces fines et des symboles mathématiques par `t()`.
 */
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Indicateurs } from "./indicateurs";
import { CATEGORIES_DEPENSE, STATUTS_TACHE, TYPES_CHANTIER } from "./labels";
import { date, fcfa, nombre, pct } from "./format";

const ORANGE = "#ea580c";
const ENCRE = "#0f172a";
const GRIS = "#64748b";
const FILET = "#e2e8f0";

/** Remplace ce que Helvetica (Windows-1252) ne sait pas afficher. */
export function t(v: unknown): string {
  return String(v ?? "")
    .replace(/[   ]/g, " ")
    .replace(/[−–]/g, "-")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/÷/g, "/")
    .replace(/×/g, "x")
    .replace(/[√Σᵢ]/g, (c) => ({ "√": "racine ", Σ: "somme ", ᵢ: "i" })[c] ?? c)
    .replace(/[“”«»]/g, '"');
}

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontSize: 9, fontFamily: "Helvetica", color: ENCRE },
  entete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: ORANGE, marginBottom: 14 },
  tuile: { width: 46, height: 46, borderRadius: 10, backgroundColor: "#14141f", padding: 6, marginRight: 10 },
  titre: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  sousTitre: { fontSize: 9, color: GRIS, marginTop: 2 },
  section: { marginTop: 14 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", color: ORANGE, marginBottom: 6 },
  note: { fontSize: 7.5, color: GRIS, marginTop: 4 },
  grille: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  carte: { width: "25%", padding: 3 },
  carteInt: { borderWidth: 1, borderColor: FILET, borderRadius: 6, padding: 7 },
  carteNom: { fontSize: 7.5, color: GRIS },
  carteVal: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
  ligne: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: FILET, paddingVertical: 3.5 },
  enteteTab: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: ENCRE, paddingBottom: 3, marginBottom: 1 },
  th: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: GRIS },
  alerte: { borderLeftWidth: 3, paddingLeft: 6, paddingVertical: 3, marginBottom: 5 },
  barreFond: { height: 5, backgroundColor: "#f1f5f9", borderRadius: 3, marginTop: 2 },
  pied: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: GRIS },
});

function Tableau({ colonnes, lignes }: { colonnes: [string, number][]; lignes: (string | React.ReactNode)[][] }) {
  return (
    <View>
      <View style={s.enteteTab} fixed>
        {colonnes.map(([nom, largeur]) => (
          <Text key={nom} style={[s.th, { width: `${largeur}%` }]}>
            {t(nom)}
          </Text>
        ))}
      </View>
      {lignes.map((l, i) => (
        <View key={i} style={s.ligne} wrap={false}>
          {l.map((c, j) => (
            <View key={j} style={{ width: `${colonnes[j][1]}%`, paddingRight: 4 }}>
              {typeof c === "string" ? <Text>{t(c)}</Text> : c}
            </View>
          ))}
        </View>
      ))}
      {!lignes.length && <Text style={s.note}>Aucune donnée.</Text>}
    </View>
  );
}

function Barre({ valeur, couleur = ORANGE }: { valeur: number; couleur?: string }) {
  const v = Number.isFinite(valeur) ? Math.max(0, Math.min(100, valeur)) : 0;
  return (
    <View style={s.barreFond}>
      <View style={{ width: `${v}%`, height: 5, backgroundColor: couleur, borderRadius: 3 }} />
    </View>
  );
}

export interface DonneesRapport {
  chantier: { code: string; nom: string; type: keyof typeof TYPES_CHANTIER; localisation: string; dateDebutPrevue: Date; dateFinPrevue: Date; client: string };
  auteur: string;
  logo: string;
  ind: Indicateurs;
  rapports: { date: Date; meteo: string; travaux: string; incidents: string | null }[];
}

export function RapportChantier({ chantier: c, auteur, logo, ind, rapports }: DonneesRapport) {
  const f = ind.finances;
  const a = ind.avancement;
  const d = f.descriptif;
  const p = ind.productivite;
  const edition = new Date();
  const cartes: [string, string][] = [
    ["Budget (révisé)", fcfa(f.budget)],
    ["Budget consommé", `${pct(f.consommePct)}`],
    ["Trésorerie disponible", fcfa(f.tresorerie)],
    ["Avances validées", fcfa(f.avancesValidees)],
    ["Avancement validé", pct(a.global)],
    ["Avancement prévu à ce jour", pct(a.prevu)],
    ["Indice de délai (SPI)", nombre(a.spi, 2)],
    ["Indice de coût (CPI)", nombre(a.cpi, 2)],
    ["Fin prévue", date(c.dateFinPrevue)],
    ["Fin estimée", a.dateFinEstimee ? date(a.dateFinEstimee) : "non fiable"],
    ["Taux de présence", pct(ind.personnel.tauxPresence)],
    ["Taux de justification", pct(f.tauxJustification)],
  ];

  return (
    <Document title={`Rapport ${c.code}`} author={auteur} subject="Rapport de chantier" creator="Gestion de chantier">
      <Page size="A4" style={s.page}>
        <View style={s.entete}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={s.tuile}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={logo} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </View>
            <View>
              <Text style={s.titre}>{t(`Rapport de chantier - ${c.nom}`)}</Text>
              <Text style={s.sousTitre}>
                {t(`${c.code} · ${TYPES_CHANTIER[c.type]} · ${c.localisation} · Client : ${c.client}`)}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 8, color: GRIS }}>{t(`Édité le ${date(edition)}`)}</Text>
            <Text style={{ fontSize: 8, color: GRIS }}>{t(`par ${auteur}`)}</Text>
            <Text style={{ fontSize: 8, color: GRIS }}>{t(`Période : ${ind.periode}`)}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>1. Synthèse</Text>
          <View style={s.grille}>
            {cartes.map(([nom, val]) => (
              <View key={nom} style={s.carte}>
                <View style={s.carteInt}>
                  <Text style={s.carteNom}>{t(nom)}</Text>
                  <Text style={s.carteVal}>{t(val)}</Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={s.note}>
            {t("SPI = valeur acquise / valeur planifiée ; CPI = valeur acquise / coût réel. Sous 1 : retard sur le planning, ou travaux plus chers que prévu. Avancement pondéré par le coût prévu des tâches, productions validées seulement.")}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>{t(`2. Alertes (${ind.alertes.length})`)}</Text>
          {ind.alertes.length === 0 && <Text>Aucune alerte : tous les indicateurs sont dans leurs seuils.</Text>}
          {ind.alertes.map((al, i) => (
            <View key={i} style={[s.alerte, { borderLeftColor: al.niveau === "critique" ? "#dc2626" : "#f59e0b" }]} wrap={false}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{t(`${al.code} - ${al.titre}`)}</Text>
              <Text>{t(al.message)}</Text>
              <Text style={{ color: GRIS, fontSize: 7.5 }}>{t(`Règle : ${al.regle}. Décision : ${al.decision}. Traité par : ${al.responsable}.`)}</Text>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <Text style={s.h2}>3. Finances : répartition des dépenses validées</Text>
          <Tableau
            colonnes={[["Catégorie", 30], ["Montant", 22], ["Part", 28], ["Cumul", 12], ["Classe", 8]]}
            lignes={f.parCategorie.map((x) => [
              CATEGORIES_DEPENSE[x.categorie as keyof typeof CATEGORIES_DEPENSE],
              fcfa(x.montant),
              <View key="b">
                <Text>{t(pct(x.part))}</Text>
                <Barre valeur={x.part} />
              </View>,
              pct(x.partCumulee),
              x.classe,
            ])}
          />
          <Text style={s.note}>
            {t(`Dépenses payées : ${fcfa(f.payees)} ; engagées non payées : ${fcfa(f.engagees)} ; budget restant : ${fcfa(f.budgetRestant)} ; coût moyen journalier : ${fcfa(f.coutMoyenJournalier)}.`)}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>4. Avancement des tâches</Text>
          <Tableau
            colonnes={[["Lot", 14], ["Tâche", 32], ["Réalisé / prévu", 18], ["Réalisation", 16], ["Retard", 8], ["Statut", 12]]}
            lignes={a.taches.map((x) => [
              x.lot,
              x.designation,
              `${nombre(x.realise, 1)} / ${nombre(x.quantitePrevue, 1)} ${x.unite}`,
              <View key="b">
                <Text>{t(pct(x.taux))}</Text>
                <Barre valeur={x.taux} couleur="#3b82f6" />
              </View>,
              x.retard > 0 ? `${x.retard} j` : "-",
              STATUTS_TACHE[x.statut],
            ])}
          />
        </View>

        <View style={s.section}>
          <Text style={s.h2}>5. Matériaux et stock</Text>
          <Tableau
            colonnes={[["Matériau", 28], ["Stock", 15], ["Autonomie", 12], ["Taux de perte", 13], ["Prix moyen pondéré", 17], ["Variation du prix", 15]]}
            lignes={ind.materiaux.map((m) => [
              m.designation,
              `${nombre(m.stock, 1)} ${m.unite}`,
              Number.isFinite(m.autonomie) ? `${nombre(m.autonomie, 1)} j` : "non calculable",
              pct(m.tauxPerte),
              fcfa(m.prixMoyenPondere),
              pct(m.variationPrix),
            ])}
          />
          <Text style={s.note}>{t("Autonomie = stock / consommation moyenne des 10 derniers jours ouvrés. Taux de perte = pertes / quantités reçues.")}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>6. Statistiques</Text>
          <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 3 }}>Dépenses journalières (FCFA)</Text>
          <Tableau
            colonnes={[["Effectif n", 12], ["Moyenne", 15], ["Médiane", 15], ["Écart-type", 15], ["Q1 / Q3", 23], ["CV", 8], ["IC 95 % moyenne", 12]]}
            lignes={[
              [
                String(d.n),
                fcfa(d.moyenne),
                fcfa(d.mediane),
                fcfa(d.ecartType),
                `${fcfa(d.q1)} / ${fcfa(d.q3)}`,
                pct(d.cv),
                d.ic95 ? `${nombre(d.ic95.bas / 1000, 0)}k - ${nombre(d.ic95.haut / 1000, 0)}k` : "-",
              ],
            ]}
          />
          {d.boite && (
            <Text style={s.note}>{t(`${d.boite.atypiques.length} journée(s) atypique(s) au-delà de Q3 + 1,5 x IQR (${fcfa(d.boite.bornesHaute)}) : signalées, jamais retirées du calcul.`)}</Text>
          )}
          <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 3 }}>{t(`Régression : heures travaillées et quantité produite (${p.tachePrincipale ?? "aucune tâche"})`)}</Text>
          <Text>
            {t(
              p.regression
                ? `y = ${nombre(p.regression.a, 3)} x ${p.regression.b >= 0 ? "+" : "-"} ${nombre(Math.abs(p.regression.b), 2)} ; r = ${nombre(p.regression.r, 3)} ; r2 = ${nombre(p.regression.r2, 3)} ; n = ${p.regression.n}. Corrélation effectif / productivité : ${nombre(p.correlationEffectif, 3)}.`
                : "Moins de 7 observations : régression non calculée.",
            )}
          </Text>
          <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 3 }}>Prévision de la date de fin</Text>
          <Text>
            {t(
              a.regression
                ? `Avancement = ${nombre(a.regression.a, 2)} x jour + ${nombre(a.regression.b, 2)} (r2 = ${nombre(a.regression.r2, 3)}, n = ${a.regression.n}). Fin estimée : ${a.dateFinEstimee ? date(a.dateFinEstimee) : "non fiable"}, ${a.fiabiliteFin}.`
                : "Pas assez de jours de production pour une tendance.",
            )}
          </Text>
          <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 3 }}>Personnel</Text>
          <Text>
            {t(
              `Taux de présence ${pct(ind.personnel.tauxPresence)} (moyenne journalière ${pct(ind.personnel.descriptifPresence.moyenne)}, écart-type ${nombre(ind.personnel.descriptifPresence.ecartType, 1)} points). Heures supplémentaires : ${nombre(ind.personnel.heuresSup, 1)} h. Coût théorique de la main-d'œuvre : ${fcfa(ind.personnel.coutMOTheorique)} ; coût payé : ${fcfa(ind.personnel.coutMOPaye)}.`,
            )}
          </Text>
          <Text style={s.note}>{t("Une corrélation est une association statistique, pas forcément une relation de cause à effet.")}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>{t(`7. Derniers rapports journaliers validés (${rapports.length})`)}</Text>
          <Tableau
            colonnes={[["Date", 12], ["Météo", 12], ["Travaux réalisés", 54], ["Incidents", 22]]}
            lignes={rapports.map((r) => [date(r.date), r.meteo, r.travaux, r.incidents ?? "-"])}
          />
        </View>

        <View style={s.pied} fixed>
          <Text>{t(`${c.code} · Rapport de chantier · Dadji Rick-Mael, ingénieur en génie civil`)}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
