import Link from "next/link";
import { AlertTriangle, ArrowRight, Building2, MapPin } from "lucide-react";
import { prisma } from "@/lib/db";
import { exigerSession, filtreChantiers } from "@/lib/auth";
import { chargerDonnees } from "@/lib/donnees";
import { calculerIndicateurs } from "@/lib/indicateurs";
import { aujourdhui, date, fcfa, pct } from "@/lib/format";
import { STATUTS_CHANTIER, TYPES_CHANTIER } from "@/lib/labels";
import { creerChantier } from "@/app/actions";
import { Bandeau, Champ, Choix, Formulaire, Pastille, Section, Tableau, tonStatut } from "@/components/app/ui";
import { Cadres, type Cadre } from "@/components/app/Cadres";
import { Barres } from "@/components/app/graphiques";
import { MotDePasse } from "@/components/app/MotDePasse";

export default async function PageChantiers({ searchParams }: { searchParams: { erreur?: string; ok?: string } }) {
  const s = await exigerSession();
  const chantiers = await prisma.chantier.findMany({ where: filtreChantiers(s), include: { client: true }, orderBy: { creeLe: "desc" } });
  const jour = aujourdhui();
  const lignes = await Promise.all(
    chantiers.map(async (c) => ({ c, ind: calculerIndicateurs(await chargerDonnees(c.id), jour) })),
  );
  const clients = s.role === "INGENIEUR" ? await prisma.utilisateur.findMany({ where: { role: "CLIENT", actif: true }, orderBy: { nom: "asc" } }) : [];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{s.role === "INGENIEUR" ? "Mes chantiers" : "Chantiers"}</h1>
        <p className="text-sm text-muted-foreground">{chantiers.length} chantier(s) dans votre périmètre</p>
      </div>
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      <Cadres
        cadres={[
          { id: "liste", titre: "Chantiers", icone: "chantier", compte: chantiers.length, contenu: (
<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lignes.map(({ c, ind }) => (
          <Link key={c.id} href={`/chantiers/${c.id}`} className="group rounded-xl bg-card border border-border p-5 shadow-sm transition-all hover:border-primary/40 hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.code} · {TYPES_CHANTIER[c.type]}
                  </p>
                </div>
              </div>
              <Pastille ton={tonStatut(c.statut)}>{STATUTS_CHANTIER[c.statut]}</Pastille>
            </div>
            <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {c.localisation} · Client : {c.client.prenom} {c.client.nom}
            </p>
            <div className="mt-4 space-y-2">
              <Barre label="Avancement validé" valeur={ind.avancement.global} couleur="bg-primary" />
              <Barre label="Budget consommé" valeur={ind.finances.consommePct} couleur={ind.finances.consommePct - ind.avancement.global > 10 ? "bg-amber-500" : "bg-emerald-500"} />
            </div>
            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Fin prévue le {date(c.dateFinPrevue)}</span>
              {ind.alertes.length > 0 ? (
                <span className="flex items-center gap-1 font-medium text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" /> {ind.alertes.length} alerte(s)
                </span>
              ) : (
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              )}
            </div>
          </Link>
        ))}
      </div>
          ) },
          ...(s.role === "INGENIEUR" && lignes.length > 1 ? [{ id: "comparaison", titre: "Comparaison", icone: "comparer", contenu: (
<Section titre="Comparaison des chantiers" description="Indicateurs calculés de la même façon pour chaque chantier : les périmètres sont comparables (RG-94).">
          <div className="grid gap-6 lg:grid-cols-2">
            <Barres
              data={lignes.map(({ c, ind }) => ({ nom: c.code, avancement: +ind.avancement.global.toFixed(1), budget: +ind.finances.consommePct.toFixed(1) }))}
              x="nom"
              series={[
                { cle: "avancement", nom: "Avancement validé (%)" },
                { cle: "budget", nom: "Budget consommé (%)" },
              ]}
            />
            <Tableau entetes={["Chantier", "SPI", "CPI", "Présence", "Justification", "Alertes"]}>
              {lignes.map(({ c, ind }) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.code}</td>
                  <td className="tabular-nums">{ind.avancement.spi.toFixed(2)}</td>
                  <td className="tabular-nums">{Number.isFinite(ind.avancement.cpi) ? ind.avancement.cpi.toFixed(2) : "—"}</td>
                  <td className="tabular-nums">{pct(ind.personnel.tauxPresence)}</td>
                  <td className="tabular-nums">{pct(ind.finances.tauxJustification)}</td>
                  <td>{ind.alertes.length}</td>
                </tr>
              ))}
            </Tableau>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            SPI = valeur acquise ÷ valeur planifiée (&lt; 1 : en retard sur le planning). CPI = valeur acquise ÷ coût réel (&lt; 1 : les travaux coûtent plus que prévu).
            Total engagé : {fcfa(lignes.reduce((a, l) => a + l.ind.finances.consomme, 0))}.
          </p>
        </Section>          ) } as Cadre] : []),
          ...(s.role === "INGENIEUR" ? [{ id: "nouveau", titre: "Nouveau chantier", icone: "ajout", contenu: (
<Formulaire action={creerChantier} titre="Créer un chantier" description="Après la création, enregistrez les matériaux à gérer puis les tâches (RG-10)." bouton="Créer le chantier" cache={{ retour: "/chantiers" }}>
          <Champ label="Code" name="code" placeholder="BAT-2026-03" />
          <Champ label="Nom" name="nom" />
          <Champ label="Localisation" name="localisation" />
          <Choix label="Type de chantier" name="type" options={Object.entries(TYPES_CHANTIER)} />
          <Champ label="Budget initial (FCFA)" name="budgetInitial" type="number" min={1} />
          <Champ label="Début prévu" name="dateDebutPrevue" type="date" />
          <Champ label="Fin prévue" name="dateFinPrevue" type="date" />
          <Champ label="Seuil de validation des dépenses (FCFA)" name="seuilValidation" type="number" defaultValue={250000} />
          <Champ label="Seuil d'alerte budget (%)" name="seuilAlerteBudget" type="number" defaultValue={90} />
          <Choix label="Client existant" name="clientId" requis={false} options={clients.map((c) => [c.id, `${c.prenom} ${c.nom} (${c.telephone})`])} />
          <Champ label="… ou nouveau client : nom" name="clientNom" requis={false} />
          <Champ label="Prénom" name="clientPrenom" requis={false} />
          <Champ label="Téléphone" name="clientTelephone" requis={false} />
          <MotDePasse name="clientMotDePasse" label="Mot de passe provisoire" requis={false} placeholder="8 caractères minimum" autoComplete="new-password" />
        </Formulaire>          ) } as Cadre] : []),
        ]}
      />
    </div>
  );
}

function Barre({ label, valeur, couleur }: { label: string; valeur: number; couleur: string }) {
  const v = Number.isFinite(valeur) ? Math.min(100, Math.max(0, valeur)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{pct(valeur)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${couleur}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
