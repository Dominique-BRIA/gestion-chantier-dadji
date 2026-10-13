import { AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  titre,
  valeur,
  icone: Icone,
  sousTitre,
  couleur = "#6366f1",
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
    <Card className={cn("border-0 shadow-sm bg-white dark:bg-zinc-900", className)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{titre}</p>
            <p className="text-2xl font-bold tracking-tight tabular-nums truncate">{valeur}</p>
            {sousTitre && <p className="text-xs text-zinc-400 dark:text-zinc-500">{sousTitre}</p>}
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${couleur}1a` }}>
            <Icone className="h-5 w-5" style={{ color: couleur }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Section({
  titre,
  description,
  children,
  actions,
  className,
}: {
  titre: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-0 shadow-sm bg-white dark:bg-zinc-900", className)}>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{titre}</CardTitle>
          {description && <p className="text-xs text-zinc-500 dark:text-zinc-400">{description}</p>}
        </div>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Bandeau({ erreur, ok }: { erreur?: string; ok?: string }) {
  if (!erreur && !ok) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-4 py-3 text-sm",
        erreur
          ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
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
    <p className="mt-3 flex items-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

const TONS = {
  vert: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  orange: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  rouge: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  gris: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
};
export type Ton = keyof typeof TONS;

export function Pastille({ ton = "gris", children }: { ton?: Ton; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", TONS[ton])}>{children}</span>;
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
          <tr className="border-b dark:border-zinc-800 text-left text-xs text-zinc-500 dark:text-zinc-400">
            {entetes.map((e) => (
              <th key={e} className="px-2 py-2 font-medium whitespace-nowrap">
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr]:border-b [&_tr]:dark:border-zinc-800 [&_tr:last-child]:border-0 [&_td]:px-2 [&_td]:py-2 [&_td]:align-top">
          {children}
        </tbody>
      </table>
      {vide && <p className="px-2 py-6 text-center text-sm text-zinc-500">Aucune donnée pour l&apos;instant.</p>}
    </div>
  );
}

const champ =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Champ({
  label,
  name,
  type = "text",
  requis = true,
  ...rest
}: { label: string; name: string; type?: string; requis?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
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
    <label className="space-y-1 text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
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

export function Bouton({
  children,
  variante = "primaire",
  className,
  ...rest
}: { variante?: "primaire" | "secondaire" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 h-9 text-sm font-medium transition-colors disabled:opacity-50",
        variante === "primaire" && "bg-primary text-primary-foreground hover:bg-primary/90",
        variante === "secondaire" &&
          "border border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800",
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
      <Bouton variante={variante} className="h-7 px-2 text-xs">
        {children}
      </Bouton>
    </form>
  );
}

/** Formulaire repliable : la page reste lisible, la saisie est à un clic. */
export function Formulaire({
  action,
  titre,
  children,
  bouton = "Enregistrer",
  cache,
  ouvert,
}: {
  action: Action;
  titre: string;
  children: React.ReactNode;
  bouton?: string;
  cache?: Record<string, string | number>;
  ouvert?: boolean;
}) {
  return (
    <details open={ouvert} className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-3 open:border-solid">
      <summary className="cursor-pointer text-sm font-medium text-indigo-600 dark:text-indigo-400">{titre}</summary>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
        {cache && Object.entries(cache).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {children}
        <div>
          <Bouton type="submit">{bouton}</Bouton>
        </div>
      </form>
    </details>
  );
}
