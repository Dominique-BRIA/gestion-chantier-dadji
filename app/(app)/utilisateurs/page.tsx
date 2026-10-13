import { prisma } from "@/lib/db";
import { exigerSession } from "@/lib/auth";
import { fcfa } from "@/lib/format";
import { ROLES } from "@/lib/labels";
import { basculerActif, creerUtilisateur } from "@/app/actions";
import { ActionLigne, Bandeau, Champ, Choix, Formulaire, Pastille, Section, Tableau } from "@/components/app/ui";
import { Cadres } from "@/components/app/Cadres";

export default async function Utilisateurs({ searchParams }: { searchParams: { erreur?: string; ok?: string } }) {
  await exigerSession(["INGENIEUR"]);
  const utilisateurs = await prisma.utilisateur.findMany({
    include: { affectations: { where: { dateFin: null }, include: { chantier: true } } },
    orderBy: [{ role: "asc" }, { nom: "asc" }],
  });
  const retour = "/utilisateurs";
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground">Seul l&apos;ingénieur crée et désactive les comptes ; un compte n&apos;est jamais supprimé (RG-02).</p>
      </div>
      <Bandeau erreur={searchParams.erreur} ok={searchParams.ok} />
      <Cadres
        cadres={[
          { id: "comptes", titre: "Comptes", icone: "equipe", compte: utilisateurs.length, contenu: (
      <Section titre="Comptes">
        <Tableau entetes={["Nom", "Rôle", "Téléphone", "Métier / taux", "Affectation en cours", "État", ""]}>
          {utilisateurs.map((u) => (
            <tr key={u.id} className={u.actif ? "" : "opacity-50"}>
              <td className="font-medium">
                {u.prenom} {u.nom}
              </td>
              <td>
                <Pastille ton={u.role === "INGENIEUR" ? "indigo" : "gris"}>{ROLES[u.role]}</Pastille>
              </td>
              <td className="text-xs">{u.telephone}</td>
              <td className="text-xs">{u.metier ? `${u.metier} · ${fcfa(u.tauxJournalier)}` : "—"}</td>
              <td className="text-xs">{u.affectations.map((a) => a.chantier.code).join(", ") || "—"}</td>
              <td>
                <Pastille ton={u.actif ? "vert" : "rouge"}>{u.actif ? "Actif" : "Désactivé"}</Pastille>
              </td>
              <td>
                {u.role !== "INGENIEUR" && (
                  <ActionLigne action={basculerActif} champs={{ id: u.id, retour }}>
                    {u.actif ? "Désactiver" : "Réactiver"}
                  </ActionLigne>
                )}
              </td>
            </tr>
          ))}
        </Tableau>
      </Section>
          ) },
          { id: "nouveau", titre: "Nouveau compte", icone: "plus", contenu: (
      <Formulaire action={creerUtilisateur} titre="Créer un compte" description="Le téléphone sert d'identifiant ; le mot de passe provisoire compte au moins 8 caractères." cache={{ retour }}>
        <Choix label="Rôle" name="role" options={[["MANOEUVRE", "Manœuvre"], ["CHEF_CHANTIER", "Chef de chantier"], ["CLIENT", "Client"]]} />
        <Champ label="Nom" name="nom" />
        <Champ label="Prénom" name="prenom" />
        <Champ label="Téléphone (identifiant)" name="telephone" />
        <Champ label="Mot de passe provisoire" name="motDePasse" minLength={8} />
        <Champ label="E-mail" name="email" type="email" requis={false} />
        <Champ label="Métier (manœuvre)" name="metier" requis={false} placeholder="Maçon, ferrailleur…" />
        <Champ label="Taux journalier (FCFA)" name="tauxJournalier" type="number" requis={false} />
      </Formulaire>
          ) },
        ]}
      />
    </div>
  );
}
