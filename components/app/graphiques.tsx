"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { histogramme, type Boite } from "@/lib/stats";

// Palette d'alanya-admin : indigo en tête, puis des teintes distinctes en clair comme en sombre.
export const COULEURS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899", "#84cc16"];

const axe = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const infobulle = {
  contentStyle: {
    borderRadius: "12px",
    border: "1px solid hsl(var(--border))",
    backgroundColor: "hsl(var(--popover))",
    color: "hsl(var(--popover-foreground))",
    fontSize: "12px",
  },
};
const fmt = (v: unknown) => (typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : String(v ?? ""));

interface Serie {
  cle: string;
  nom: string;
  couleur?: string;
  pointille?: boolean;
}

export function Courbes({ data, x, series, hauteur = 260 }: { data: Record<string, unknown>[]; x: string; series: Serie[]; hauteur?: number }) {
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey={x} tick={axe} axisLine={false} tickLine={false} minTickGap={16} />
          <YAxis tick={axe} axisLine={false} tickLine={false} width={64} tickFormatter={fmt} />
          <Tooltip {...infobulle} formatter={fmt} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => (
            <Line
              key={s.cle}
              type="monotone"
              dataKey={s.cle}
              name={s.nom}
              stroke={s.couleur ?? COULEURS[i]}
              strokeWidth={2}
              strokeDasharray={s.pointille ? "5 4" : undefined}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Barres({
  data,
  x,
  series,
  hauteur = 260,
  horizontal,
  empile,
}: {
  data: Record<string, unknown>[];
  x: string;
  series: Serie[];
  hauteur?: number;
  horizontal?: boolean;
  empile?: boolean;
}) {
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={!!horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={axe} axisLine={false} tickLine={false} tickFormatter={fmt} />
              <YAxis type="category" dataKey={x} tick={axe} axisLine={false} tickLine={false} width={150} />
            </>
          ) : (
            <>
              <XAxis dataKey={x} tick={axe} axisLine={false} tickLine={false} minTickGap={8} />
              <YAxis tick={axe} axisLine={false} tickLine={false} width={64} tickFormatter={fmt} />
            </>
          )}
          <Tooltip {...infobulle} formatter={fmt} cursor={{ fill: "hsl(var(--muted))" }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar key={s.cle} dataKey={s.cle} name={s.nom} fill={s.couleur ?? COULEURS[i]} radius={empile ? 0 : 4} stackId={empile ? "a" : undefined} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Camembert({ data, hauteur = 260 }: { data: { nom: string; valeur: number }[]; hauteur?: number }) {
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="valeur" nameKey="nom" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="none">
            {data.map((_, i) => (
              <Cell key={i} fill={COULEURS[i % COULEURS.length]} />
            ))}
          </Pie>
          <Tooltip {...infobulle} formatter={fmt} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Pareto : barres décroissantes et courbe du cumul en %. */
export function Pareto({ data, hauteur = 280 }: { data: { nom: string; valeur: number; cumul: number }[]; hauteur?: number }) {
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="nom" tick={axe} axisLine={false} tickLine={false} interval={0} />
          <YAxis yAxisId="v" tick={axe} axisLine={false} tickLine={false} width={64} tickFormatter={fmt} />
          <YAxis yAxisId="c" orientation="right" domain={[0, 100]} tick={axe} axisLine={false} tickLine={false} unit=" %" width={44} />
          <Tooltip {...infobulle} formatter={fmt} />
          <Bar yAxisId="v" dataKey="valeur" name="Valeur" fill={COULEURS[0]} radius={4} />
          <Line yAxisId="c" dataKey="cumul" name="Cumul (%)" stroke={COULEURS[2]} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Nuage de points et droite des moindres carrés y = a·x + b. */
export function Nuage({
  points,
  droite,
  xNom,
  yNom,
  hauteur = 280,
}: {
  points: { x: number; y: number }[];
  droite: { a: number; b: number } | null;
  xNom: string;
  yNom: string;
  hauteur?: number;
}) {
  const xs = points.map((p) => p.x);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const ligne = droite ? [min, max].map((x) => ({ x, y: droite.a * x + droite.b })) : [];
  return (
    <div style={{ height: hauteur }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ left: 4, right: 8, top: 8, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" dataKey="x" name={xNom} tick={axe} domain={["auto", "auto"]} label={{ value: xNom, position: "insideBottom", offset: -8, fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name={yNom} tick={axe} width={56} label={{ value: yNom, angle: -90, position: "insideLeft", fontSize: 11 }} />
          <Tooltip {...infobulle} formatter={fmt} />
          <Scatter data={points} fill={COULEURS[0]} name="Observations" />
          {droite && <Line data={ligne} dataKey="y" stroke={COULEURS[3]} strokeWidth={2} dot={false} name="Droite de régression" legendType="line" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Histogramme en classes de Sturges. */
export function Histogramme({ valeurs, unite, hauteur = 240 }: { valeurs: number[]; unite: string; hauteur?: number }) {
  const classes = histogramme(valeurs).map((c) => ({
    classe: `${Math.round(c.borneInf / 1000)}–${Math.round(c.borneSup / 1000)} k`,
    effectif: c.effectif,
  }));
  return <Barres data={classes} x="classe" series={[{ cle: "effectif", nom: `Nombre de jours (${unite})` }]} hauteur={hauteur} />;
}

/** Boîte à moustaches de Tukey, tracée en SVG. */
export function BoiteMoustaches({ boite, unite }: { boite: Boite; unite: string }) {
  const format = (v: number) => `${v.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${unite}`;
  const lo = Math.min(boite.min, boite.bornesBasse);
  const hi = Math.max(boite.max, boite.bornesHaute);
  const pos = (v: number) => 20 + ((v - lo) / (hi - lo || 1)) * 560;
  const basse = Math.max(boite.min, boite.bornesBasse);
  const haute = Math.min(boite.max, boite.bornesHaute);
  return (
    <svg viewBox="0 0 600 110" className="w-full h-28 text-zinc-500">
      <line x1={pos(basse)} x2={pos(boite.q1)} y1={45} y2={45} stroke="currentColor" />
      <line x1={pos(boite.q3)} x2={pos(haute)} y1={45} y2={45} stroke="currentColor" />
      <line x1={pos(basse)} x2={pos(basse)} y1={33} y2={57} stroke="currentColor" />
      <line x1={pos(haute)} x2={pos(haute)} y1={33} y2={57} stroke="currentColor" />
      <rect x={pos(boite.q1)} y={25} width={pos(boite.q3) - pos(boite.q1)} height={40} rx={4} fill="#6366f133" stroke="#6366f1" />
      <line x1={pos(boite.mediane)} x2={pos(boite.mediane)} y1={25} y2={65} stroke="#6366f1" strokeWidth={3} />
      {boite.atypiques.map((v, i) => (
        <circle key={i} cx={pos(v)} cy={45} r={4} fill="#ef4444" />
      ))}
      {[
        ["Q1", boite.q1],
        ["Médiane", boite.mediane],
        ["Q3", boite.q3],
      ].map(([n, v], i) => (
        <text key={n as string} x={pos(v as number)} y={i === 1 ? 16 : 85 + (i === 2 ? 14 : 0)} textAnchor="middle" fontSize="11" fill="currentColor">
          {n} : {format(v as number)}
        </text>
      ))}
    </svg>
  );
}
