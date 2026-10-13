# Gestion de chantier

Système d'information de gestion de chantier et de ses matériaux, avec des indicateurs
statistiques d'aide à la décision. Projet de l'unité d'enseignement Statistique.

- Cahier de conception : `gestion_statistique_chantier_cahier_conception.pdf`
- Règles de gestion : [`docs/REGLES-DE-GESTION.md`](docs/REGLES-DE-GESTION.md) (RG-01 à RG-94, alertes AL-01 à AL-15)

## Acteurs

| Rôle | Ce qu'il fait |
|---|---|
| Ingénieur (SuperRoot) | Crée les chantiers, les comptes, les tâches et les matériaux ; valide ; voit toutes les statistiques |
| Client | Suit l'avancement, déclare ses avances de fonds, consulte les dépenses validées, signale une anomalie |
| Chef de chantier | Saisit le stock, les dépenses, les présences, la production et les rapports |
| Manœuvre | Pointe sa présence, signale la fin d'une tâche, un manque ou un incident |

## Où se trouvent les calculs

| Fichier | Contenu |
|---|---|
| `lib/stats.ts` | Statistique pure : moyenne, médiane, mode, variance, quartiles, CV, boîte à moustaches, histogramme, corrélation, régression, moyenne mobile, Pareto, intervalle de confiance |
| `lib/indicateurs.ts` | Indicateurs du cahier (§ 4 et § 5), valeur acquise (SPI, CPI), date de fin estimée et les 15 alertes |
| `lib/*.test.ts` | 26 tests, dont un chantier fictif calculé à la main |
| `lib/rapport-pdf.tsx` | Rapport de chantier en PDF (bouton « Rapport PDF », ingénieur et client) |

## Lancer en local

Prérequis : Node.js 20 ou plus, PostgreSQL.

```bash
npm install
cp .env.example .env           # puis renseigner DATABASE_URL, DIRECT_URL et SESSION_SECRET
npx prisma migrate dev         # crée la base et ses tables
npm run db:seed                # charge 2 chantiers fictifs (environ 50 jours d'activité)
npm run dev                    # http://localhost:3000
npm test                       # tests des calculs
npx tsx scripts/verifier-indicateurs.ts   # indicateurs de chaque chantier dans le terminal
```

Comptes de démonstration, mot de passe `Chantier2026` :

| Téléphone | Rôle |
|---|---|
| 690000001 | Ingénieur |
| 690000002 | Client du chantier « Villa R+1 Mendong » |
| 690000003 | Client du chantier « Route Nkolbisson » |
| 690000010 | Chef de chantier (villa) |
| 690000100 | Manœuvre (villa) |

`npm run db:seed` refuse de tourner sur une base qui contient déjà des chantiers. Pour tout effacer
et recharger : `npm run db:seed -- --reinitialiser`.

## Déploiement : Neon, Backblaze B2, Vercel

### 1. Base de données sur Neon

1. Créer un projet sur [neon.tech](https://neon.tech), région la plus proche (Europe).
2. Copier les deux chaînes de connexion :
   - **pooled** (l'hôte contient `-pooler`) → `DATABASE_URL`, en ajoutant `&pgbouncer=true` ;
   - **direct** (sans `-pooler`) → `DIRECT_URL`.
3. Les tables sont créées automatiquement au premier déploiement (`prisma migrate deploy`).
4. Pour une démonstration, charger les données fictives depuis le poste :
   `DATABASE_URL="<direct>" npm run db:seed`

### 2. Justificatifs sur Backblaze B2

1. Créer un compartiment **privé** (bucket), par exemple `gestion-chantier-justificatifs`.
2. Créer une clé d'application limitée à ce compartiment, en lecture et écriture.
3. Renseigner `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET` et `B2_ENDPOINT`
   (de la forme `https://s3.eu-central-003.backblazeb2.com`, affiché sur la page du compartiment).

Sans ces variables, l'application fonctionne : on saisit seulement la référence du justificatif.

Contrôle de la configuration : `npx tsx --env-file=.env scripts/tester-stockage.ts` (dépose, relit puis supprime un petit PDF).

### 3. Application sur Vercel

1. Pousser le dépôt sur GitHub, puis l'importer dans [vercel.com](https://vercel.com) : « Add New → Project ».
2. Renseigner les variables d'environnement : `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`
   (32 caractères aléatoires au moins) et, si besoin, les 4 variables `B2_*`.
3. Déployer. La commande de build (`npm run build`) applique les migrations, puis compile.

## Architecture

- **Next.js 14** (App Router), pages rendues côté serveur. Chaque page et chaque action serveur
  vérifie le rôle et le périmètre du chantier (RG-03, RG-04).
- **Prisma 6 et PostgreSQL** : 17 tables ; rien n'est supprimé, une erreur se corrige par une
  opération opposée (RG-24) ; journal d'audit en écriture seule (RG-81).
- **Interface** : style et bibliothèques d'alanya-admin (Tailwind, composants shadcn,
  icônes lucide-react, graphiques recharts, mode sombre next-themes).
- **Session** : cookie signé HMAC-SHA256 (`lib/session.ts`), mots de passe hachés par scrypt.
