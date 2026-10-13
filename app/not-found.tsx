import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function Introuvable() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <SearchX className="h-7 w-7" />
      </span>
      <div>
        <h1 className="text-xl font-bold">Page introuvable</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cette page n&apos;existe pas, ou elle ne fait pas partie de vos chantiers.</p>
      </div>
      <Link href="/espace" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 h-10 text-sm font-semibold hover:border-primary/50">
        <ArrowLeft className="h-4 w-4" /> Revenir à mon espace
      </Link>
    </div>
  );
}
