// Jeton de session signé HMAC-SHA256 avec Web Crypto : le même code tourne dans
// le middleware (runtime Edge) et dans les pages serveur (runtime Node).

export type Role = "INGENIEUR" | "CLIENT" | "CHEF_CHANTIER" | "MANOEUVRE";

export interface Session {
  id: number;
  role: Role;
  nom: string;
  exp: number;
}

export const COOKIE_SESSION = "session";
export const DUREE_SESSION_S = 60 * 60 * 12;

const encodeur = new TextEncoder();

function b64url(octets: Uint8Array): string {
  let s = "";
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function depuisB64url(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function cle(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET absent ou trop court (32 caractères minimum)");
  return crypto.subtle.importKey("raw", encodeur.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signerSession(s: Omit<Session, "exp">): Promise<string> {
  const charge = b64url(encodeur.encode(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + DUREE_SESSION_S })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await cle(), encodeur.encode(charge)));
  return `${charge}.${b64url(sig)}`;
}

export async function lireSession(jeton: string | undefined): Promise<Session | null> {
  if (!jeton) return null;
  const [charge, sig] = jeton.split(".");
  if (!charge || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await cle(), depuisB64url(sig), encodeur.encode(charge));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(depuisB64url(charge))) as Session;
    return s.exp > Date.now() / 1000 ? s : null;
  } catch {
    return null;
  }
}
