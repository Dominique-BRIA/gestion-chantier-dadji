"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Champ de mot de passe avec un œil pour afficher ou masquer la saisie. */
export function MotDePasse({
  name,
  label,
  requis = true,
  icone = false,
  autoComplete = "current-password",
  placeholder,
  minLength,
}: {
  name: string;
  label: string;
  requis?: boolean;
  icone?: boolean;
  autoComplete?: string;
  placeholder?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="font-medium">{label}</span>
      <span className="relative block">
        {icone && <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
        <input
          name={name}
          type={visible ? "text" : "password"}
          required={requis}
          autoComplete={autoComplete}
          placeholder={placeholder}
          minLength={minLength}
          className={cn(
            "h-11 w-full rounded-xl border border-input bg-background/60 pr-11 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            icone ? "pl-10" : "pl-3",
          )}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          title={visible ? "Masquer" : "Afficher"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}
