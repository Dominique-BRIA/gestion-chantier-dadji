-- CreateEnum
CREATE TYPE "Role" AS ENUM ('INGENIEUR', 'CLIENT', 'CHEF_CHANTIER', 'MANOEUVRE');

-- CreateEnum
CREATE TYPE "TypeChantier" AS ENUM ('BATIMENT', 'ROUTE', 'OUVRAGE_ART', 'ASSAINISSEMENT_VRD', 'AUTRE');

-- CreateEnum
CREATE TYPE "StatutChantier" AS ENUM ('PREPARATION', 'EN_COURS', 'SUSPENDU', 'TERMINE');

-- CreateEnum
CREATE TYPE "StatutTache" AS ENUM ('A_FAIRE', 'EN_COURS', 'TERMINEE');

-- CreateEnum
CREATE TYPE "StatutValidation" AS ENUM ('EN_ATTENTE', 'VALIDEE', 'REJETEE');

-- CreateEnum
CREATE TYPE "TypeMouvement" AS ENUM ('ENTREE', 'SORTIE', 'PERTE', 'RETOUR', 'CORRECTION');

-- CreateEnum
CREATE TYPE "CategorieDepense" AS ENUM ('MATERIAUX', 'MAIN_OEUVRE', 'TRANSPORT', 'LOCATION_MATERIEL', 'DIVERS');

-- CreateEnum
CREATE TYPE "ModePaiement" AS ENUM ('ESPECES', 'VIREMENT', 'MOBILE_MONEY', 'CHEQUE');

-- CreateEnum
CREATE TYPE "StatutPresence" AS ENUM ('PRESENT', 'RETARD', 'ABSENT');

-- CreateEnum
CREATE TYPE "TypeSignalement" AS ENUM ('MANQUE_MATERIAU', 'PERTE', 'INCIDENT', 'ANOMALIE', 'DEMANDE_JUSTIFICATION');

-- CreateEnum
CREATE TYPE "StatutSignalement" AS ENUM ('OUVERT', 'EN_COURS', 'CLOS');

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "email" TEXT,
    "motDePasseHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "metier" TEXT,
    "tauxJournalier" INTEGER,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chantier" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "localisation" TEXT NOT NULL,
    "type" "TypeChantier" NOT NULL,
    "budgetInitial" INTEGER NOT NULL,
    "dateDebutPrevue" TIMESTAMP(3) NOT NULL,
    "dateFinPrevue" TIMESTAMP(3) NOT NULL,
    "dateDebutReelle" TIMESTAMP(3),
    "dateFinReelle" TIMESTAMP(3),
    "statut" "StatutChantier" NOT NULL DEFAULT 'PREPARATION',
    "seuilValidation" INTEGER NOT NULL DEFAULT 250000,
    "seuilAlerteBudget" INTEGER NOT NULL DEFAULT 90,
    "seuils" JSONB NOT NULL DEFAULT '{}',
    "motifSuspension" TEXT,
    "ingenieurId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "creeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chantier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affectation" (
    "id" SERIAL NOT NULL,
    "utilisateurId" INTEGER NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "fonction" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),

    CONSTRAINT "Affectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tache" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "lot" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "unite" TEXT NOT NULL,
    "quantitePrevue" DOUBLE PRECISION NOT NULL,
    "coutPrevu" INTEGER NOT NULL,
    "dateDebutPrevue" TIMESTAMP(3) NOT NULL,
    "dateFinPrevue" TIMESTAMP(3) NOT NULL,
    "dateDebutReelle" TIMESTAMP(3),
    "dateFinReelle" TIMESTAMP(3),
    "statut" "StatutTache" NOT NULL DEFAULT 'A_FAIRE',
    "finDeclareeLe" TIMESTAMP(3),
    "finConfirmee" BOOLEAN NOT NULL DEFAULT false,
    "causeRetard" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Tache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Production" (
    "id" SERIAL NOT NULL,
    "tacheId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "heuresTravaillees" DOUBLE PRECISION NOT NULL,
    "effectif" INTEGER NOT NULL,
    "declareParId" INTEGER NOT NULL,
    "statut" "StatutValidation" NOT NULL DEFAULT 'EN_ATTENTE',
    "valideParId" INTEGER,

    CONSTRAINT "Production_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Materiau" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "unite" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "prixReference" INTEGER NOT NULL,
    "delaiLivraisonJours" INTEGER NOT NULL DEFAULT 3,
    "seuilAlerteJours" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "Materiau_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MouvementStock" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "materiauId" INTEGER NOT NULL,
    "type" "TypeMouvement" NOT NULL,
    "quantite" DOUBLE PRECISION NOT NULL,
    "prixUnitaire" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "motif" TEXT,
    "tacheId" INTEGER,
    "auteurId" INTEGER NOT NULL,
    "corrigeId" INTEGER,

    CONSTRAINT "MouvementStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventaire" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "materiauId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "stockTheorique" DOUBLE PRECISION NOT NULL,
    "stockPhysique" DOUBLE PRECISION NOT NULL,
    "auteurId" INTEGER NOT NULL,
    "commentaire" TEXT,
    "valide" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Inventaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avance" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "montant" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mode" "ModePaiement" NOT NULL,
    "reference" TEXT,
    "statut" "StatutValidation" NOT NULL DEFAULT 'EN_ATTENTE',

    CONSTRAINT "Avance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Depense" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "categorie" "CategorieDepense" NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "justificatif" TEXT,
    "fichierCle" TEXT,
    "mouvementId" INTEGER,
    "statut" "StatutValidation" NOT NULL DEFAULT 'EN_ATTENTE',
    "datePaiement" TIMESTAMP(3),
    "auteurId" INTEGER NOT NULL,
    "valideParId" INTEGER,

    CONSTRAINT "Depense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presence" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "ouvrierId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "statut" "StatutPresence" NOT NULL,
    "heuresPrevues" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "heuresRealisees" DOUBLE PRECISION NOT NULL,
    "saisieParId" INTEGER NOT NULL,
    "confirmee" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Presence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RapportJournalier" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "meteo" TEXT NOT NULL,
    "travaux" TEXT NOT NULL,
    "incidents" TEXT,
    "observations" TEXT,
    "auteurId" INTEGER NOT NULL,
    "statut" "StatutValidation" NOT NULL DEFAULT 'EN_ATTENTE',

    CONSTRAINT "RapportJournalier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signalement" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "auteurId" INTEGER NOT NULL,
    "type" "TypeSignalement" NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "statut" "StatutSignalement" NOT NULL DEFAULT 'OUVERT',
    "reponse" TEXT,
    "dateCloture" TIMESTAMP(3),

    CONSTRAINT "Signalement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Validation" (
    "id" SERIAL NOT NULL,
    "objetType" TEXT NOT NULL,
    "objetId" INTEGER NOT NULL,
    "decision" "StatutValidation" NOT NULL,
    "responsableId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commentaire" TEXT,

    CONSTRAINT "Validation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalAudit" (
    "id" SERIAL NOT NULL,
    "auteurId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entite" TEXT NOT NULL,
    "entiteId" INTEGER NOT NULL,
    "ancienneValeur" TEXT,
    "nouvelleValeur" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avenant" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "nouveauBudget" INTEGER NOT NULL,
    "motif" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auteurId" INTEGER NOT NULL,

    CONSTRAINT "Avenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourRepos" (
    "id" SERIAL NOT NULL,
    "chantierId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "declareParId" INTEGER NOT NULL,

    CONSTRAINT "JourRepos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_telephone_key" ON "Utilisateur"("telephone");

-- CreateIndex
CREATE UNIQUE INDEX "Chantier_code_key" ON "Chantier"("code");

-- CreateIndex
CREATE INDEX "Affectation_chantierId_idx" ON "Affectation"("chantierId");

-- CreateIndex
CREATE INDEX "Tache_chantierId_idx" ON "Tache"("chantierId");

-- CreateIndex
CREATE INDEX "Production_tacheId_date_idx" ON "Production"("tacheId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Materiau_chantierId_designation_key" ON "Materiau"("chantierId", "designation");

-- CreateIndex
CREATE INDEX "MouvementStock_chantierId_materiauId_date_idx" ON "MouvementStock"("chantierId", "materiauId", "date");

-- CreateIndex
CREATE INDEX "Avance_chantierId_date_idx" ON "Avance"("chantierId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Depense_mouvementId_key" ON "Depense"("mouvementId");

-- CreateIndex
CREATE INDEX "Depense_chantierId_date_idx" ON "Depense"("chantierId", "date");

-- CreateIndex
CREATE INDEX "Presence_chantierId_date_idx" ON "Presence"("chantierId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Presence_ouvrierId_date_key" ON "Presence"("ouvrierId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RapportJournalier_chantierId_date_key" ON "RapportJournalier"("chantierId", "date");

-- CreateIndex
CREATE INDEX "Validation_objetType_objetId_idx" ON "Validation"("objetType", "objetId");

-- CreateIndex
CREATE UNIQUE INDEX "JourRepos_chantierId_date_key" ON "JourRepos"("chantierId", "date");

-- AddForeignKey
ALTER TABLE "Chantier" ADD CONSTRAINT "Chantier_ingenieurId_fkey" FOREIGN KEY ("ingenieurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chantier" ADD CONSTRAINT "Chantier_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affectation" ADD CONSTRAINT "Affectation_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tache" ADD CONSTRAINT "Tache_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "Tache"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_declareParId_fkey" FOREIGN KEY ("declareParId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Production" ADD CONSTRAINT "Production_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Materiau" ADD CONSTRAINT "Materiau_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_materiauId_fkey" FOREIGN KEY ("materiauId") REFERENCES "Materiau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_tacheId_fkey" FOREIGN KEY ("tacheId") REFERENCES "Tache"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MouvementStock" ADD CONSTRAINT "MouvementStock_corrigeId_fkey" FOREIGN KEY ("corrigeId") REFERENCES "MouvementStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventaire" ADD CONSTRAINT "Inventaire_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventaire" ADD CONSTRAINT "Inventaire_materiauId_fkey" FOREIGN KEY ("materiauId") REFERENCES "Materiau"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventaire" ADD CONSTRAINT "Inventaire_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avance" ADD CONSTRAINT "Avance_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avance" ADD CONSTRAINT "Avance_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_mouvementId_fkey" FOREIGN KEY ("mouvementId") REFERENCES "MouvementStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Depense" ADD CONSTRAINT "Depense_valideParId_fkey" FOREIGN KEY ("valideParId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_ouvrierId_fkey" FOREIGN KEY ("ouvrierId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presence" ADD CONSTRAINT "Presence_saisieParId_fkey" FOREIGN KEY ("saisieParId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportJournalier" ADD CONSTRAINT "RapportJournalier_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RapportJournalier" ADD CONSTRAINT "RapportJournalier_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Validation" ADD CONSTRAINT "Validation_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalAudit" ADD CONSTRAINT "JournalAudit_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avenant" ADD CONSTRAINT "Avenant_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourRepos" ADD CONSTRAINT "JourRepos_chantierId_fkey" FOREIGN KEY ("chantierId") REFERENCES "Chantier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourRepos" ADD CONSTRAINT "JourRepos_declareParId_fkey" FOREIGN KEY ("declareParId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
