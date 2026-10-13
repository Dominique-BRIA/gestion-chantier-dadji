import { AlertTriangle, CheckCircle2, Circle, Clock3, Info, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Surface commune : carte opaque en clair, verre sombre profond en mode nuit. */
export const surface = "rounded-2xl border border-border bg-card text-card-foreground shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]";

export function StatCard({
  titre,
  valeur,
  icone: Icone,
  sousTitre,
  couleur = "#f97316",
  className,
}: {
  titre: string;
  valeur: string;
  icone: LucideIcon;
  sousTitre?: string;
  couleur?: string;
  className?: string;
}) {
  return (
    <div className={cn(surface, "p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{titre}</p>
          <p className="text-xl 2xl:text-2xl font-bold tracking-tight tabular-nums leading-tight">{valeur}</p>
          {sousTitre && <p className="text-xs text-muted-foreground">{sousTitre}</p>}
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${couleur}1f` }}>
          <Icone className="h-5 w-5" style={{ color: couleur }} />
        </div>
      </div>
    </div>
  );
}

export function Section({
  titre,
  description,
  children,
  actions,
  className,
}: {
  titre?: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(surface, "p-5 sm:p-6", className)}>
      {(titre || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {titre && <h3 className="text-base font-semibold">{titre}</h3>}
            {description && <p className="text-xs text-muted-foreground max-w-3xl">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Bandeau({ erreur, ok }: { erreur?: string; ok?: string }) {
  if (!erreur && !ok) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl px-4 py-3 text-sm border",
        erreur
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
      )}
    >
      {erreur ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
      {erreur ?? ok}
    </div>
  );
}

/** RG-90 : chaque statistique affiche sa période, son unité et son effectif. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

// Un état = une icône et une couleur de texte, sans pastille de fond.
const TONS = {
  vert: { icone: CheckCircle2, classe: "text-emerald-600 dark:text-emerald-400" },
  orange: { icone: Clock3, classe: "text-amber-600 dark:text-amber-400" },
  rouge: { icone: XCircle, classe: "text-red-600 dark:text-red-400" },
  gris: { icone: Circle, classe: "text-muted-foreground" },
  indigo: { icone: Info, classe: "text-primary" },
};
export type Ton = keyof typeof TONS;

export function Pastille({ ton = "gris", children }: { ton?: Ton; children: React.ReactNode }) {
  const { icone: Icone, classe } = TONS[ton];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap", classe)}>
      <Icone className="h-3.5 w-3.5 shrink-0" />
      {children}
    </span>
  );
}

export function tonStatut(s: string): Ton {
  if (["VALIDEE", "TERMINEE", "PRESENT", "CLOS"].includes(s)) return "vert";
  if (["EN_ATTENTE", "RETARD", "EN_COURS", "OUVERT", "SUSPENDU"].includes(s)) return "orange";
  if (["REJETEE", "ABSENT"].includes(s)) return "rouge";
  return "gris";
}

export function Tableau({ entetes, children, vide }: { entetes: string[]; children: React.ReactNode; vide?: boolean }) {
  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            {entetes.map((e, i) => (
              <th key={`${e}-${i}`} className="px-2 py-2.5 font-medium whitespace-nowrap">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr]:border-b [&_tr]:border-border/70 [&_tr:last-child]:border-0 [&_tr:hover]:bg-muted/40 [&_td]:px-2 [&_td]:py-2.5 [&_td]:align-top">
          {children}
        </tbody>
      </table>
      {vide && <p className="px-2 py-8 text-center text-sm text-muted-foreground">Aucune donnée pour l&apos;instant.</p>}
    </div>
  );
}

const champ =
  "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Champ({
  label,
  name,
  type = "text",
  requis = true,
  ...rest
}: { label: string; name: string; type?: string; requis?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <input name={name} type={type} required={requis} className={champ} {...rest} />
    </label>
  );
}

export function Choix({
  label,
  name,
  options,
  requis = true,
  defaut,
}: {
  label: string;
  name: string;
  options: [string | number, string][];
  requis?: boolean;
  defaut?: string | number;
}) {
  return (
    <label className="space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <select name={name} required={requis} defaultValue={defaut} className={champ}>
        {!requis && <option value="">—</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Zone({ label, name, requis = true, large }: { label: string; name: string; requis?: boolean; large?: boolean }) {
  return (
    <label className={cn("space-y-1.5 text-sm", large && "sm:col-span-2 lg:col-span-3")}>
      <span className="font-medium">{label}</span>
      <textarea name={name} required={requis} rows={3} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </label>
  );
}

export function Bouton({
  children,
  variante = "primaire",
  className,
  ...rest
}: { variante?: "primaire" | "secondaire" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 h-10 text-sm font-semibold transition-all disabled:opacity-50",
        variante === "primaire" && "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-[0_4px_14px_rgba(234,88,12,0.35)] hover:brightness-110",
        variante === "secondaire" && "border border-border bg-card hover:bg-muted",
        variante === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

type Action = (f: FormData) => Promise<void>;

/** Formulaire d'une seule action (valider, rejeter, payer…) avec ses champs cachés. */
export function ActionLigne({
  action,
  champs,
  children,
  variante = "secondaire",
}: {
  action: Action;
  champs: Record<string, string | number>;
  children: React.ReactNode;
  variante?: "primaire" | "secondaire" | "danger";
}) {
  return (
    <form action={action} className="inline-block">
      {Object.entries(champs).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Bouton variante={variante} className="h-8 px-3 text-xs">
        {children}
      </Bouton>
    </form>
  );
}

/** Formulaire de saisie, présenté seul dans son cadre. */
export function Formulaire({
  action,
  titre,
  description,
  children,
  bouton = "Enregistrer",
  cache,
}: {
  action: Action;
  titre: string;
  description?: string;
  children: React.ReactNode;
  bouton?: string;
  cache?: Record<string, string | number>;
}) {
  return (
    <Section titre={titre} description={description}>
      <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-end">
        {cache && Object.entries(cache).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {children}
        <div className="sm:col-span-2 lg:col-span-3">
          <Bouton type="submit">{bouton}</Bouton>
        </div>
      </form>
    </Section>
  );
}

export function Mesure({ nom, valeur }: { nom: string; valeur: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">{nom}</p>
      <p className="font-semibold tabular-nums">{valeur}</p>
    </div>
  );
}
