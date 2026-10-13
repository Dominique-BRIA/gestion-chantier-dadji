import { MapPin } from "lucide-react";
import { exigerChantier } from "@/lib/auth";
import { date, fcfa } from "@/lib/format";
import { STATUTS_CHANTIER, TYPES_CHANTIER } from "@/lib/labels";
import { Onglets } from "@/components/app/Onglets";
import { Pastille, tonStatut } from "@/components/app/ui";

// RG-05 : les onglets suivent la matrice des droits ; chaque page revérifie côté serveur.
const ONGLETS: Record<string, [string, string][]> = {
  INGENIEUR: [["", "Tableau de bord"], ["statistiques", "Statistiques"], ["travaux", "Travaux"], ["stock", "Stock"], ["finances", "Finances"], ["personnel", "Personnel"], ["rapports", "Rapports"], ["parametres", "Paramètres"]],
  CLIENT: [["", "Tableau de bord"], ["statistiques", "Statistiques"], ["travaux", "Travaux"], ["stock", "Matériaux"], ["finances", "Finances"], ["rapports", "Rapports"]],
  CHEF_CHANTIER: [["", "Tableau de bord"], ["travaux", "Travaux"], ["stock", "Stock"], ["finances", "Dépenses"], ["personnel", "Personnel"], ["rapports", "Rapports"]],
  MANOEUVRE: [["", "Mon espace"]],
};

export default async function LayoutChantier({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const { s, chantier: c } = await exigerChantier(Number(params.id));
  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{c.nom}</h1>
            <Pastille ton={tonStatut(c.statut === "EN_COURS" ? "VALIDEE" : c.statut)}>{STATUTS_CHANTIER[c.statut]}</Pastille>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-zinc-500">
            <span>{c.code}</span>·<span>{TYPES_CHANTIER[c.type]}</span>·
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {c.localisation}
            </span>
          </p>
        </div>
        {s.role !== "MANOEUVRE" && (
          <div className="text-right text-xs text-zinc-500">
            <p>
              Du {date(c.dateDebutPrevue)} au {date(c.dateFinPrevue)}
            </p>
            <p>Budget initial {fcfa(c.budgetInitial)}</p>
            {c.statut === "SUSPENDU" && <p className="text-amber-600">Suspendu : {c.motifSuspension}</p>}
          </div>
        )}
      </div>
      <Onglets base={`/chantiers/${c.id}`} onglets={ONGLETS[s.role]} />
      {children}
    </div>
  );
}
