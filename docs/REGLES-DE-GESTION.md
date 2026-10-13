# Règles de gestion

**Système d'information de gestion de chantier — étape 2 du cahier de conception**

Version de travail du 13 octobre 2026. Ce document complète le cahier de conception
(`gestion_statistique_chantier_cahier_conception.pdf`). Il répond aux cinq questions de son
étape 2 :

1. Qui peut créer une dépense, la modifier, la valider ou la rejeter ? → **§ 5**
2. Comment une avance du client est-elle enregistrée et confirmée ? → **§ 5**
3. Comment sont enregistrées les entrées, sorties, pertes et corrections de stock ? → **§ 4**
4. Comment l'avancement d'une tâche est-il mesuré et validé ? → **§ 6**
5. Quels seuils déclenchent les alertes et qui les traite ? → **§ 10**

Chaque règle porte un identifiant (`RG-xx`) que le code cite en commentaire. Une règle
qui change se modifie ici d'abord.

Les points qui étaient à valider ont été tranchés le 13 octobre 2026 (§ 12).

---

## 1. Décisions de périmètre (étape 1)

| Question | Décision |
|---|---|
| Type de chantier | **Au choix de l'ingénieur** à la création : bâtiment, route, ouvrage d'art, assainissement/VRD, autre |
| Plateforme | **Application web** |
| Chantiers par ingénieur | **Plusieurs** |
| Client | **Un client propre à chaque chantier** ; un client peut toutefois en avoir plusieurs |
| Matériaux | **Enregistrés par l'ingénieur pour chaque chantier** ; pas de catalogue commun |
| Transferts entre chantiers | **Aucun** |
| Rôle du client | **Il suit l'avancement ET il verse des avances de fonds** |
| Hébergement de production | Base **Neon** (PostgreSQL), fichiers **Backblaze B2**, application **Vercel** |

---

## 2. Acteurs et périmètre d'accès

### RG-01 — Quatre rôles, un seul par compte

| Rôle | Dans le système |
|---|---|
| **Ingénieur** | Super administrateur (SuperRoot). Propriétaire de l'application, il crée tous les autres comptes. |
| **Client** | Maître d'ouvrage. Il finance et suit son ou ses chantiers. |
| **Chef de chantier** | Il saisit les opérations quotidiennes du chantier auquel il est affecté. |
| **Manœuvre** | Ouvrier. Il dispose d'un accès simplifié au chantier auquel il est affecté. |

### RG-02 — Comptes

- Seul l'ingénieur crée, modifie et désactive les comptes.
- L'identifiant de connexion est le **numéro de téléphone**, unique dans le système.
- Un compte n'est jamais supprimé : il est **désactivé**. Ses saisies passées restent attribuées à son
  auteur, ce qu'exige la traçabilité (§ 9 du cahier).
- Un compte désactivé ne peut plus se connecter.

### RG-03 — Périmètre de données

Chaque utilisateur ne voit que les chantiers qui le concernent :

| Rôle | Chantiers visibles |
|---|---|
| Ingénieur | Ceux qu'il a créés |
| Client | Ceux dont il est le client |
| Chef de chantier, manœuvre | Ceux où il a une **affectation en cours** |

### RG-04 — Contrôle par le serveur

- Toute lecture et toute écriture est vérifiée **par le serveur** : rôle, puis périmètre RG-03.
- Masquer un bouton dans l'interface n'est jamais une protection suffisante.
- Une requête hors périmètre reçoit un refus (code 403) et ne révèle rien du chantier visé.

### RG-05 — Matrice des droits

Légende :
- **C** : créer ;
- **L** : lire ;
- **M** : modifier ;
- **V** : valider ou rejeter ;
- **—** : aucun accès.

| Objet | Ingénieur | Client | Chef de chantier | Manœuvre |
|---|---|---|---|---|
| Chantier | C L M, clôture | L | L | L (nom, adresse) |
| Comptes, affectations | C L M | — | L (son équipe) | — |
| Matériaux du chantier | C L M | L | L | — |
| Mouvements de stock | C L V | L | C L | — |
| Inventaires | L V | L (validés) | C L | — |
| Tâches | C L M | L | L | L (les siennes) |
| Productions journalières | L V | L (validées) | C L | C (fin de tâche) |
| Présences | L M | L (taux seulement) | C L M | C (son pointage) L (les siennes) |
| Avances du client | C L V | C L | — | — |
| Dépenses | C L M V | L (validées) | C L | — |
| Rapports journaliers | L V | L (validés) | C L | — |
| Signalements | L, traitement | C L (les siens) | C L | C L (les siens) |
| Statistiques et alertes | L (tout) | L (son chantier, sans les données individuelles) | L (son chantier) | — |
| Journal d'audit | L | — | — | — |

### RG-06 — Données individuelles

- Le client voit le **taux de présence** et la **productivité de l'équipe**, jamais les présences ni la
  productivité d'un ouvrier nommé.
- Un manœuvre ne voit que ses propres présences et ses propres tâches.

---

## 3. Chantier

### RG-10 — Création par l'ingénieur

L'ingénieur renseigne :
- le code (unique), le nom et la localisation ;
- le **type de chantier** ;
- le **budget initial**, en FCFA ;
- les dates de début et de fin prévues ;
- le **client**, dont il crée le compte s'il n'existe pas ;
- le **seuil de validation** des dépenses (RG-41), 250 000 FCFA par défaut ;
- le **seuil d'alerte budgétaire** (AL-09), 90 % par défaut.

Le type de chantier propose une liste de lots par défaut, que l'ingénieur peut modifier :

| Type | Lots proposés |
|---|---|
| Bâtiment | Installation, terrassement, fondations, élévation, dalle, toiture, finitions |
| Route | Installation, terrassement, couche de forme, fondation, revêtement, signalisation |
| Ouvrage d'art | Installation, fondations, appuis, tablier, équipements |
| Assainissement / VRD | Installation, tranchées, canalisations, regards, remblai, réfection |
| Autre | Aucun : l'ingénieur crée ses lots |

### RG-11 — Cycle de vie du chantier

| Transition | Autorisée | Effet |
|---|---|---|
| Préparation → en cours | Oui | La date de début réelle est enregistrée |
| En cours → suspendu | Oui, motif obligatoire | Plus aucune saisie n'est possible |
| Suspendu → en cours | Oui | Les saisies reprennent |
| En cours → terminé | Oui, c'est la **clôture** | La date de fin réelle est enregistrée |
| Terminé → autre état | **Non** | Le chantier passe en lecture seule |

- Toutes ces transitions sont réservées à l'ingénieur.
- **Avant la clôture**, il ne doit rester aucune dépense, production ou avance en attente de validation.
  Sinon, la clôture est refusée et l'application liste ce qui reste.
- Les jours de suspension ne sont **pas** comptés comme des jours observés dans les statistiques
  (RG-90).

### RG-12 — Modification du budget

- Le budget initial ne se modifie pas.
- Une révision crée un **avenant** : nouveau montant, date et motif, tracés au journal d'audit.
- Les indicateurs affichent à la fois le budget initial et le budget révisé.

Les avenants sont gérés **dès la première version**.

### RG-13 — Affectations

- L'ingénieur affecte les chefs de chantier et les manœuvres, avec une fonction et une date de début.
- Retirer une personne du chantier, c'est **clore son affectation** (date de fin), jamais la supprimer.
- Un chantier en cours a **au moins un chef de chantier** affecté.
- Un manœuvre ne peut avoir qu'**une affectation en cours à la fois** : il ne peut pas être pointé
  sur deux chantiers le même jour.

---

## 4. Matériaux et stock

### RG-20 — Matériaux du chantier

Pour chaque matériau du chantier, l'ingénieur renseigne :
- la désignation, unique dans le chantier ;
- l'**unité** : sac, kg, tonne, m³, barre, unité, etc. ;
- la catégorie ;
- le prix de référence, en FCFA par unité ;
- le délai de livraison habituel, en jours ;
- le **seuil d'alerte d'autonomie**, en jours.

Deux règles protègent l'unité :
- Après le premier mouvement, **l'unité ne peut plus être modifiée**.
- Aucune conversion implicite n'est faite. Pour changer d'unité, il faut créer un nouveau matériau.

### RG-21 — Types de mouvement

| Type | Sens | Saisi par | Données obligatoires |
|---|---|---|---|
| **Entrée** | + | Chef de chantier, ingénieur | Quantité, **prix unitaire**, fournisseur ou référence du bon de livraison |
| **Sortie** (consommation) | − | Chef de chantier | Quantité, **tâche consommatrice** |
| **Perte** | − | Chef de chantier | Quantité, **motif** (casse, vol, intempérie, péremption, etc.) |
| **Retour** fournisseur | − | Chef de chantier | Quantité, motif |
| **Correction** | ± | Ingénieur (RG-24) | Mouvement corrigé, motif |

Le « retour » désigne le **renvoi au fournisseur** d'un matériau non utilisé :
- il sort du stock ;
- il n'est **pas** compté comme une consommation.

### RG-22 — Cohérence des quantités

- Une quantité est toujours **strictement positive**. Le sens vient du type de mouvement.
- Une sortie, une perte ou un retour ne peut pas dépasser le **stock théorique** du moment.
  Sinon, la saisie est refusée avec le message : « stock insuffisant, faire un inventaire ».
- Le **stock théorique** vaut : Σ entrées − Σ sorties − Σ pertes − Σ retours ± Σ corrections.

### RG-23 — Entrée achetée et dépense : rapprochement automatique

Une **entrée** crée automatiquement une **dépense de catégorie « matériaux »**, rattachée à ce mouvement :
- son montant vaut quantité × prix unitaire ;
- elle est saisie en attente ;
- elle suit ensuite les règles des dépenses (§ 5).

Ainsi, chaque sac acheté apparaît une fois dans le stock et une fois dans les finances. C'est le
rapprochement demandé au § 1 du cahier.

### RG-24 — Corriger sans effacer

- **Aucun mouvement n'est supprimé ni modifié.**
- L'auteur d'une erreur peut l'annuler **le jour même** ; l'annulation crée un mouvement de correction
  opposé.
- Au-delà, seul l'ingénieur crée la correction, avec un motif obligatoire.
- La correction référence le mouvement corrigé : on voit toujours la saisie d'origine et sa correction.

### RG-25 — Inventaire physique

1. Le chef de chantier compte le stock et saisit le **stock physique**.
2. Le système fige le **stock théorique** du moment et calcule l'écart :
   écart = stock physique − stock théorique.
3. L'ingénieur valide l'inventaire. La validation crée **une correction** qui aligne le stock théorique
   sur le stock physique.
4. Un écart de plus de **2 %** du stock théorique déclenche l'alerte AL-12.

**Fréquence** : un inventaire **chaque semaine**, pour chaque matériau du chantier.
- Un matériau sans inventaire validé depuis plus de 7 jours déclenche l'alerte AL-15.
- Un inventaire hebdomadaire donne environ 4 écarts par mois et par matériau : assez
  d'observations pour suivre l'évolution des écarts dans le temps.

---

## 5. Finances

### RG-30 — Avance du client

Une avance peut être enregistrée de deux façons :

| Cas | Saisie | Statut initial |
|---|---|---|
| Le client déclare son versement | Le client renseigne le montant, la date, le mode (espèces, virement, mobile money, chèque) et la référence | **En attente** |
| L'ingénieur reçoit les fonds en main propre | L'ingénieur saisit l'avance | **Validée** d'office |

Ensuite :
- L'ingénieur **confirme** une avance en attente, ou la **rejette** avec un motif.
- Le client voit la décision.
- **Seule une avance validée entre dans la trésorerie.**
- Une avance validée ne se modifie plus. Une erreur se corrige par un rejet motivé et une nouvelle saisie,
  toutes deux tracées.

### RG-40 — Création d'une dépense

- **Qui** : le chef de chantier ou l'ingénieur. Une dépense « matériaux » peut aussi être créée
  automatiquement (RG-23).
- **Données obligatoires** : catégorie, libellé, montant en FCFA entiers et strictement positif, date.
- **Catégories** : matériaux, main-d'œuvre, transport, location de matériel, divers.
- **Justificatif** : numéro de facture ou de reçu, et photo ou PDF déposé sur Backblaze B2.
  Une dépense sans justificatif reste possible, mais elle est **non justifiée** :
  - elle fait baisser le taux de justification ;
  - après 48 h, elle déclenche l'alerte AL-13.

### RG-41 — Validation d'une dépense

| Montant | Traitement |
|---|---|
| ≤ seuil de validation du chantier | **Validée automatiquement** par le système, mais l'ingénieur peut la rejeter ensuite |
| > seuil de validation | **En attente** de l'ingénieur, qui la valide ou la rejette avec un motif |

- Chaque décision est inscrite dans la table `Validation` : objet, décision, auteur, date et commentaire.
- Une dépense **rejetée** ne compte dans aucun indicateur, mais elle reste visible dans l'historique.

### RG-42 — Modification d'une dépense

- Son auteur peut la modifier **tant qu'elle est en attente**.
- Une fois validée, **plus personne ne la modifie**. L'ingénieur la rejette avec un motif, puis une
  nouvelle dépense est saisie.
- Chaque modification est inscrite au journal d'audit, avec l'ancienne et la nouvelle valeur.

### RG-43 — Engagée et payée

| État | Condition |
|---|---|
| **Engagée** | Validée, sans date de paiement |
| **Payée** | Validée, avec une date de paiement saisie par l'ingénieur |

Ces deux états servent à des calculs différents :
- **Budget consommé** = Σ dépenses validées, engagées et payées.
- **Trésorerie disponible** = Σ avances validées − Σ dépenses **payées**.
- **Budget restant** = budget − budget consommé. Ce n'est pas la trésorerie, comme l'explique le § 4.1
  du cahier.

### RG-44 — Coût de la main-d'œuvre

Le coût de la main-d'œuvre se calcule de deux façons, que l'on compare :

| Calcul | Formule | Usage |
|---|---|---|
| **Coût théorique** | Σ (heures réalisées ÷ heures prévues) × taux journalier, par présence | Statistiques de productivité |
| **Coût payé** | Σ dépenses « main-d'œuvre » | Finances |

Un écart durable entre les deux est à examiner : présences mal saisies, ou paie non enregistrée.

Les heures supplémentaires sont payées **au même taux**, sans majoration, dans la première version.

### RG-45 — Ce que voit le client

Le client voit :
- les **dépenses validées** et leurs justificatifs ;
- le budget consommé, la trésorerie et ses avances.

Il ne voit **pas** les dépenses en attente ni les dépenses rejetées.

Sur toute dépense, il peut ouvrir un **signalement** « demande de justification » (RG-70).

---

## 6. Tâches et avancement

### RG-50 — Création des tâches

L'ingénieur crée les tâches, rattachées à un lot. Pour chacune, il renseigne :
- la désignation et l'**unité d'ouvrage** : m², m³, ml, unité, forfait, etc. ;
- la **quantité prévue** ;
- le **coût prévu**, qui sert de poids dans l'avancement global (RG-55) ;
- les dates de début et de fin prévues.

Deux contrôles s'appliquent :
- La somme des coûts prévus des tâches ne doit pas dépasser le budget. Sinon, l'application affiche un
  avertissement.
- La quantité prévue ne se modifie plus après la première production validée. Une révision passe par
  le journal d'audit.

### RG-51 — Déclaration de production

Chaque jour, le chef de chantier déclare pour chaque tâche travaillée :
- la quantité réalisée, dans l'unité de la tâche ;
- les heures travaillées sur cette tâche ;
- l'effectif présent sur cette tâche.

La déclaration est créée **en attente**.

### RG-52 — Fin de tâche

1. Un manœuvre affecté à une tâche peut **déclarer sa fin**.
2. Le chef de chantier confirme ou refuse.
3. L'ingénieur valide la clôture de la tâche, ce qui enregistre la date de fin réelle.

### RG-53 — Validation de l'avancement

- L'ingénieur valide les productions **par lot ou par période**, par exemple chaque semaine.
- **Seules les productions validées** entrent dans l'avancement physique. Le cahier présente
  l'avancement comme « la progression déclarée et validée ».
- Le tableau de bord affiche à part ce qui est **déclaré mais pas encore validé**.

### RG-54 — Statut automatique des tâches

| Événement | Effet |
|---|---|
| Première production déclarée | La tâche passe **en cours** ; la date de début réelle est enregistrée |
| Clôture validée (RG-52) | La tâche passe **terminée** ; la date de fin réelle est enregistrée |
| Quantité réalisée > quantité prévue | Le taux de réalisation est **plafonné à 100 %**, et un signalement automatique demande de revoir le métré |

### RG-55 — Calculs d'avancement

- **Taux de réalisation d'une tâche** = min(100 %, Σ quantités validées ÷ quantité prévue).
- **Avancement global pondéré** = Σ (taux de réalisationᵢ × coût prévuᵢ) ÷ Σ coût prévuᵢ.
  - Chaque tâche n'est comptée qu'une fois.
  - Une moyenne simple des pourcentages est interdite, conformément au § 4.4 du cahier.
- **Retard d'une tâche**, en jours ouvrés :
  - tâche terminée : max(0, fin réelle − fin prévue) ;
  - tâche non terminée, une fois la date prévue dépassée : aujourd'hui − fin prévue.
- **Taux de retard** = retard ÷ durée prévue × 100.
- Une tâche terminée en retard exige une **cause déclarée** : intempéries, rupture de matériaux,
  manque de main-d'œuvre, panne, modification du client ou autre.

---

## 7. Personnel et présences

### RG-60 — Saisie des présences

Le chef de chantier saisit, **chaque jour ouvré**, une ligne par manœuvre affecté :
- le statut : présent, en retard ou absent ;
- les heures réalisées.

Trois contraintes s'appliquent :
- Une seule ligne par ouvrier et par jour : la base l'impose par une contrainte d'unicité.
- Un absent compte **0 heure** réalisée.
- Les heures prévues valent 8 par défaut.

### RG-61 — Pointage du manœuvre

- Le manœuvre peut **pointer** lui-même son arrivée.
- Ce pointage est une déclaration, que le chef de chantier confirme ou corrige.
- En cas de désaccord, la saisie du chef de chantier fait foi. Le pointage d'origine reste dans le
  journal.

### RG-62 — Heures supplémentaires

Heures supplémentaires = max(0, heures réalisées − heures prévues).

### RG-63 — Jours ouvrés et jours de repos

**Tous les jours sont ouvrés, du lundi au dimanche.**

Le chef de chantier peut toutefois déclarer **un jour de repos par semaine** :
- il choisit le jour, qui vaut pour **cette semaine-là seulement** ;
- il le déclare **avant** ce jour, ou le jour même tant qu'aucune présence n'est saisie ;
- il peut l'annuler dans les mêmes conditions ;
- l'ingénieur peut aussi déclarer ou annuler un jour de repos.

Un jour de repos a les effets suivants :
- aucune présence n'est attendue : personne n'y est compté absent ;
- aucun rapport journalier n'est attendu : l'alerte AL-11 ne se déclenche pas ;
- il n'est **pas un jour observé** pour les statistiques (RG-90) ;
- une saisie y reste possible (travail exceptionnel), et le jour redevient alors un jour observé.

Les jours fériés sont des jours ordinaires, sauf si le chef de chantier les déclare comme jour de
repos de la semaine.

---

## 8. Rapports journaliers et signalements

### RG-65 — Rapport journalier

- Le chef de chantier soumet **un rapport par jour ouvré**.
- Le rapport contient : la météo, les travaux réalisés, les incidents et les observations.
- L'ingénieur le valide. Le client ne lit que les rapports validés.
- Un rapport absent le lendemain à **12 h** déclenche l'alerte AL-11.

### RG-70 — Signalements

| Qui | Types possibles |
|---|---|
| Manœuvre | Manque de matériau, perte, incident |
| Chef de chantier | Tous |
| Client | Anomalie, demande de justification |

Le traitement d'un signalement suit trois étapes :
1. L'ingénieur le prend en charge : **ouvert → en cours**.
2. Il le clôt avec une **réponse écrite** : **en cours → clos**.
3. L'auteur voit cette réponse.

Les règles de l'outil :
- Un signalement ne se supprime pas.
- Un signalement est une **demande d'examen, pas une accusation** (§ 8 du cahier).

---

## 9. Clôture journalière et traçabilité

### RG-80 — Clôture journalière

Les saisies d'un jour J ont trois états successifs :

| Moment | Qui peut modifier |
|---|---|
| Jusqu'au jour J + 1 à 23 h 59 | L'auteur |
| Après | Seul l'ingénieur, par une correction motivée |

Cette règle concerne les présences, les productions et les mouvements de stock.

### RG-81 — Journal d'audit

Le journal d'audit reçoit une ligne pour chaque création, modification, validation, rejet ou
correction. Il contient :
- l'auteur et la date ;
- l'action, l'objet concerné ;
- l'ancienne et la nouvelle valeur.

Le journal est **en écriture seule** : aucun rôle ne peut le modifier ni le supprimer.

### RG-82 — Sauvegarde

En production, Neon assure la sauvegarde et la restauration à un instant donné.

Un export mensuel complet archivé sur Backblaze B2 est **reporté** après la première version.

---

## 10. Alertes

Conformément au § 8 du cahier, chaque alerte affiche quatre informations :
- **la règle** déclenchée ;
- **la période** étudiée ;
- **les données** utilisées ;
- **la personne** habilitée à la traiter.

Une alerte est un **signal à examiner**, jamais une preuve de faute.

**Destinataire** : toutes les alertes vont à l'ingénieur. Le chef de chantier reçoit aussi celles qui
concernent ses opérations (AL-01, AL-02, AL-08, AL-11, AL-12, AL-14, AL-15).

| Code | Situation | Règle de déclenchement | Décision suggérée |
|---|---|---|---|
| AL-01 | Rupture de stock prévisible | Autonomie < délai de livraison → **critique** ; autonomie < seuil d'alerte → **attention**. Autonomie = stock ÷ consommation moyenne des 10 derniers jours ouvrés | Commander maintenant |
| AL-02 | Pertes en hausse | Taux de perte des 14 derniers jours > 5 %, **et** supérieur à celui des 14 jours précédents | Vérifier le stockage et les sorties |
| AL-03 | Dépenses plus rapides que les travaux | Budget consommé (%) − avancement global (%) > **10 points** | Examiner les achats anticipés et le stock avant de conclure à un dépassement |
| AL-04 | Rendement en baisse | Productivité horaire d'une même tâche en baisse **3 jours ouvrés de suite**, avec au moins 5 observations | Analyser les causes : météo, approvisionnement, effectif |
| AL-05 | Retards concentrés | Un même lot (ou une même cause) cumule **≥ 50 %** des jours de retard du chantier | Réorganiser le planning |
| AL-06 | Dépense inhabituelle | Montant > Q3 + 1,5 × IQR des dépenses de la **même catégorie** ; au moins 10 dépenses de référence, sinon pas d'alerte | Demander le justificatif |
| AL-07 | Trésorerie insuffisante | Trésorerie ÷ coût moyen journalier des 14 derniers jours ouvrés < **7 jours** | Demander une avance au client |
| AL-08 | Travaux non validés | Une production attend sa validation depuis plus de **3 jours** | Organiser un contrôle sur le terrain |
| AL-09 | Budget presque épuisé | Budget consommé ≥ seuil d'alerte du chantier (90 % par défaut) | Préparer un avenant ou un arbitrage |
| AL-10 | Dépassement de délai prévisible | Date de fin estimée (RG-93) > date de fin prévue | Renforcer l'équipe ou revoir le planning |
| AL-11 | Rapport manquant | Aucun rapport du jour J à J + 1, 12 h | Relancer le chef de chantier |
| AL-12 | Écart d'inventaire | \|écart\| > 2 % du stock théorique | Recompter, puis expliquer l'écart |
| AL-13 | Dépense non justifiée | Une dépense sans justificatif depuis plus de 48 h | Réclamer la pièce |
| AL-14 | Présence faible | Taux de présence du jour < **80 %** | Vérifier les causes d'absence |
| AL-15 | Inventaire en retard | Un matériau sans inventaire validé depuis plus de **7 jours** | Faire l'inventaire hebdomadaire |

Ces seuils (5 %, 10 points, 7 jours, 2 %, 80 %, etc.) sont des **valeurs par défaut**. Ils sont
stockés comme des **paramètres**, et l'ingénieur peut les modifier pour chaque chantier.

---

## 11. Règles de calcul statistique

Ces règles répondent au § 5.6 du cahier : période, unité, nombre d'observations, données manquantes,
division par zéro, valeurs extrêmes.

### RG-90 — Période et observations

- La période d'analyse est de **30 derniers jours ouvrés** par défaut. Elle peut être choisie :
  semaine, mois, depuis le début, ou dates libres.
- Un **jour observé** est un jour ouvré, hors suspension et hors jour de repos (RG-63), où au moins une
  saisie existe pour la grandeur
  étudiée.
- Chaque indicateur affiche : **sa période, son unité, le nombre d'observations n et le nombre de jours
  sans donnée**.

### RG-91 — Effectifs minimaux

| Calcul | n minimum | En dessous |
|---|---|---|
| Moyenne, médiane | 3 | « Données insuffisantes » |
| Écart-type, coefficient de variation, quartiles | 5 | « Données insuffisantes » |
| Boîte à moustaches, valeurs atypiques | 10 | La boîte n'est pas tracée |
| Corrélation, régression | 7 | Pas de droite tracée |
| Prévision de la date de fin | 10, **et r² ≥ 0,8** | « Tendance non fiable » |

### RG-92 — Conventions de calcul

- **Variance** :
  - divisée par **n** pour décrire la période observée ;
  - divisée par **n − 1** pour estimer (intervalle de confiance, prévision).
- **Quartiles** : interpolation linéaire, la méthode d'Excel `QUARTILE.INCLUS`. Les résultats se
  vérifient donc au tableur.
- **Coefficient de variation** : calculé seulement si la moyenne est strictement positive.
  - CV < 15 % : série homogène ;
  - de 15 à 30 % : dispersion modérée ;
  - CV > 30 % : série irrégulière.
- **Valeurs extrêmes** : repérées par la règle de Tukey (au-delà de Q1 − 1,5 × IQR ou de Q3 + 1,5 × IQR).
  Elles sont **signalées, jamais supprimées** des calculs.
- **Division par zéro** : l'application affiche « non calculable », jamais 0.
  Par exemple, l'autonomie d'un stock sans consommation n'est pas calculable.
- **Arrondis** : à l'affichage seulement ; les calculs gardent la pleine précision.
  - Montants : en FCFA entiers.
  - Pourcentages : à 1 décimale.
  - Quantités : à 2 décimales.

### RG-93 — Date de fin estimée

1. Les données sont l'avancement global cumulé (RG-55), jour ouvré par jour ouvré.
2. On calcule la droite des moindres carrés : avancement = a × jour + b.
3. La date estimée est le jour où la droite atteint 100 %, soit (100 − b) ÷ a.
4. L'application affiche cette date avec son **hypothèse** : « si le rythme moyen observé se maintient ».
   Elle affiche aussi r² et n.
5. Si a ≤ 0 ou si RG-91 n'est pas respectée, elle affiche « tendance non fiable ».

### RG-94 — Comparaisons

- La productivité ne se compare qu'entre des tâches de **même unité d'ouvrage et de même métier**
  (§ 4.3 du cahier).
- Deux périodes ou deux chantiers ne se comparent que sur des durées et des indicateurs identiques.
- Une corrélation s'affiche toujours avec la mention : « association statistique, pas forcément une
  relation de cause à effet ».

---

## 12. Décisions du 13 octobre 2026

| Réf. | Question | Décision |
|---|---|---|
| RG-12 | Avenants au budget dès la première version ? | Oui |
| RG-21 | « Retour » = renvoi au fournisseur ? | Oui |
| RG-25 | Fréquence des inventaires ? | **Chaque semaine**, pour chaque matériau (alerte AL-15) |
| RG-44 | Majoration des heures supplémentaires ? | Aucune dans la première version |
| RG-63 | Jours ouvrés ? | **Du lundi au dimanche** ; le chef de chantier peut déclarer **un jour de repos par semaine** |
| RG-82 | Export mensuel archivé sur B2 ? | Plus tard, pas dans la première version |
| § 10 | Valeurs des seuils d'alerte ? | Celles du tableau, modifiables par chantier |
