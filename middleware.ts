import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSION, lireSession } from "@/lib/session";

// Premier filtre : sans session valide, retour à la connexion. Les droits fins
// (rôle, périmètre du chantier) sont vérifiés par chaque page et chaque action.
export async function middleware(req: NextRequest) {
  const s = await lireSession(req.cookies.get(COOKIE_SESSION)?.value);
  if (!s) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  // L'accueil (/), la connexion et les fichiers statiques restent publics.
  matcher: ["/((?!login|_next|favicon.ico|icon.png|logo.png|fonts).+)"],
};
