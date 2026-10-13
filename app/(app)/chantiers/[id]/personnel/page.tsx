import { prisma } from "@/lib/db";
import { exigerChantier } from "@/lib/auth";
import { ajouterJours, aujourdhui, cleJour, date, fcfa, jourUTC, nombre, pct } from "@/lib/format";
import { STATUTS_PRESENCE } from "@/lib/labels";
import { affecter, annulerRepos, declarerRepos, saisirPresences, terminerAffectation } from "@/app/actions";
import { ActionLigne, Bandeau, Bouton, Champ, Choix, Formulaire, Note, Pastille, Section, Tableau } from "@/components/app/ui";
import { Cadres, type Cadre } from "@/components/app/Cadres";

export default async function Personnel({ params, searchParams }: { params: { id: string }; searchParams: { erreur?: string; ok?: string; date?: string } }) {
  const { s, chantier } = await exigerChantier(Number(params.id), ["INGENIEUR", "CHEF_CHANTIER"]);
  const id = chantier.id;
  const retour = `/chantiers/${id}/personnel`;
  const cache = { chantierId: id, retour };
  const ouvert = chantier.statut === "EN_COURS";
  const jour = searchParams.date ? jourUTC(searchParams.date) : aujourdhui();
  const debut30 = ajouterJours(aujourdhui(), -29);

  const [affectations, presencesJour, presences30, repos, disponibles] = await Promise.all([
    prisma.affectation.findMany({ where: { chantierId: id }, include: { utilisateur: true }, orderBy: [{ dateFin: "asc" }, { id: "asc" }] }),
    prisma.presence.findMany({ where: { chantierId: id, date: jour } }),
    prisma.presence.findMany({ where: { chantierId: id, date: { gte: debut30 } }, include: { ouvrier: true } }),
    prisma.jourRepos.findMany({ where: { chantierId: id }, orderBy: { date: "desc" }, take: 8 }),
    s.role === "INGENIEUR"
      ? prisma.utilisateur.findMany({ where: { role: { in: ["CHEF_CHANTIER", "MANOEUVRE"] }, actif: true, affectations: { none: { dateFin: null, chantierId: id } } }, orderBy: { nom: "asc" } })
      : [],
  ]);
  const equipe = affectations.filter((a) => !a.dateFin && a.utilisateur.role === "MANOEUVRE");
  const parOuvrier = new Map(presencesJour.map((p) => [p.ouvrierId, p]));
  const repos30 = new Set(repos.map((r) => cleJour(r.date)));
  const estRepos = repos30.has(cleJour(jour));

  // Statistiques individuelles : réservées à l'ingénieur et au chef (RG-06).
  const stats = equipe.map((a) => {
    const ps = presences30.filter((p) => p.ouvrierId === a.utilisateurId);
    const prevues = ps.reduce((x, p) => x + p.heuresPrevues, 0);
    const realisees = ps.reduce((x, p) => x + p.heuresRealisees, 0);
    return {
      a,
      n: ps.length,
      absences: ps.filter((p) => p.statut === "ABSENT").length,
      retards: ps.filter((p) => p.statut === "RETARD").length,
      taux: prevues ? (realisees / prevues) * 100 : NaN,
      sup: ps.reduce((x, p) => x + Math.max(0, p.heuresRealisees - p.heuresPrevues), 0),
      cout: ps.reduce((x, p) => x + (p.heuresRealisees / p.heuresPrevues) * (a.utilisateur.tauxJournalier ?? 0), 0),
    };
  });

  const cadres: Cadre[] = [
    { id: "jour", titre: "Présences du jour", icone: "presence", contenu: (
<Section
        titre={`Présences du ${date(jour)}`}
        description="Une ligne par manœuvre et par jour (RG-60). Le chef saisit le jour même ou le lendemain ; au-delà, seul l'ingénieur (RG-80)."
        actions={
          <form className="flex gap-1">
            <input type="date" name="date" defaultValue={cleJour(jour)} className="h-8 rounded-md border border-input bg-background px-2 text-xs" />
            <Bouton variante="secondaire" className="h-8 text-xs">
              Afficher
            </Bouton>
          </form>
        }
      >
        {estRepos && <p className="mb-3 text-sm text-primary">Jour de repos déclaré : aucune présence n&apos;est attendue (RG-63).</p>}
        <form action={saisirPresences}>
          {Object.entries({ ...cache, date: cleJour(jour), retour: `${retour}?date=${cleJour(jour)}` }).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <Tableau entetes={["Manœuvre", "Métier", "Statut", "Heures réalisées", ""]} vide={!equipe.length}>
            {equipe.map((a) => {
              const p = parOuvrier.get(a.utilisateurId);
              return (
                <tr key={a.id}>
                  <td className="font-medium">
                    {a.utilisateur.prenom} {a.utilisateur.nom}
                  </td>
                  <td className="text-xs text-muted-foreground">{a.utilisateur.metier}</td>
                  <td>
                    <select name={`statut_${a.utilisateurId}`} defaultValue={p?.statut ?? ""} className="h-8 rounded-md border border-input bg-background px-2 text-sm">
                      <option value="">—</option>
                      {Object.entries(STATUTS_PRESENCE).map(([k, l]) => (
                        <option key={k} value={k}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input name={`heures_${a.utilisateurId}`} type="number" step="0.5" min="0" max="16" defaultValue={p?.heuresRealisees ?? 8} className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm" />
                  </td>
                  <td className="text-xs">{p && !p.confirmee && <Pastille ton="orange">pointage à confirmer</Pastille>}</td>
                </tr>
              );
            })}
          </Tableau>
          {ouvert && equipe.length > 0 && (
            <div className="mt-3">
              <Bouton type="submit">Enregistrer les présences</Bouton>
            </div>
          )}
        </form>
      </Section>
    ) },
    { id: "stats", titre: "Sur 30 jours", icone: "stats", contenu: (
<Section titre="Présence sur 30 jours, par manœuvre" description="Taux = heures réalisées ÷ heures prévues. Heures supplémentaires = max(0, réalisées − prévues).">
          <Tableau entetes={["Manœuvre", "Jours", "Absences", "Retards", "Taux", "H. sup.", "Coût théorique"]} vide={!stats.length}>
            {stats.map((x) => (
              <tr key={x.a.id}>
                <td>
                  {x.a.utilisateur.prenom} {x.a.utilisateur.nom}
                </td>
                <td className="tabular-nums">{x.n}</td>
                <td className="tabular-nums">{x.absences}</td>
                <td className="tabular-nums">{x.retards}</td>
                <td>
                  <Pastille ton={x.taux < 80 ? "rouge" : x.taux < 95 ? "orange" : "vert"}>{pct(x.taux)}</Pastille>
                </td>
                <td className="tabular-nums">{nombre(x.sup, 1)} h</td>
                <td className="tabular-nums whitespace-nowrap">{fcfa(x.cout)}</td>
              </tr>
            ))}
          </Tableau>
          <Note>Coût théorique = Σ (heures réalisées ÷ heures prévues) × taux journalier ; il se compare à la paie enregistrée en dépenses (RG-44).</Note>
        </Section>
    ) },
    { id: "repos", titre: "Jours de repos", icone: "repos", contenu: (
<Section titre="Jours de repos" description="Tous les jours sont ouvrés ; un jour de repos par semaine peut être déclaré à l'avance (RG-63).">
          {ouvert && (
            <form action={declarerRepos} className="mb-4 flex flex-wrap items-end gap-2">
              {Object.entries(cache).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
              <Champ label="Date du repos" name="date" type="date" min={cleJour(aujourdhui())} />
              <Bouton>Déclarer</Bouton>
            </form>
          )}
          <Tableau entetes={["Date", "Jour", ""]} vide={!repos.length}>
            {repos.map((r) => (
              <tr key={r.id}>
                <td>{date(r.date)}</td>
                <td className="capitalize">{r.date.toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" })}</td>
                <td>
                  {ouvert && r.date >= aujourdhui() && (
                    <ActionLigne action={annulerRepos} champs={{ ...cache, id: r.id }}>
                      Annuler
                    </ActionLigne>
                  )}
                </td>
              </tr>
            ))}
          </Tableau>
        </Section>
    ) },
    { id: "equipe", titre: "Équipe", icone: "equipe", contenu: (
<Section titre="Équipe affectée" description="Retirer une personne clôt son affectation ; rien n'est supprimé (RG-13).">
        <Tableau entetes={["Nom", "Fonction", "Téléphone", "Depuis", "Jusqu'au", ""]}>
          {affectations.map((a) => (
            <tr key={a.id} className={a.dateFin ? "opacity-50" : ""}>
              <td className="font-medium">
                {a.utilisateur.prenom} {a.utilisateur.nom}
              </td>
              <td>{a.fonction}</td>
              <td className="text-xs">{a.utilisateur.telephone}</td>
              <td>{date(a.dateDebut)}</td>
              <td>{a.dateFin ? date(a.dateFin) : "—"}</td>
              <td>
                {s.role === "INGENIEUR" && ouvert && !a.dateFin && (
                  <ActionLigne action={terminerAffectation} champs={{ ...cache, id: a.id }}>
                    Retirer
                  </ActionLigne>
                )}
              </td>
            </tr>
          ))}
        </Tableau>
      </Section>
    ) },
  ];
  if (s.role === "INGENIEUR" && ouvert) cadres.push({ id: "affecter", titre: "Affecter", icone: "plus", contenu: (
<Formulaire action={affecter} titre="Affecter un chef de chantier ou un manœuvre" description="Un manœuvre n'a qu'une affectation en cours à la fois (RG-13)." cache={cache}>
              <Choix label="Personne" name="utilisateurId" options={disponibles.map((u) => [u.id, `${u.prenom} ${u.nom} — ${u.role === "MANOEUVRE" ? (u.metier ?? "Manœuvre") : "Chef de chantier"}`])} />
              <Champ label="Fonction" name="fonction" requis={false} />
              <Champ label="Date de début" name="dateDebut" type="date" defaultValue={cleJour(aujourdhui())} />
            </Formulaire>
  ) });

  return (
    <div className="space-y-5">
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      <Cadres cadres={cadres} />
    </div>
  );
}
