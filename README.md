# MG Elec & Plans

**Vos plans électriques, simplement.**

MG Elec & Plans est une application web mobile (PWA installable) destinée aux électriciens : à partir d’un plan, d’un scan, d’un PDF ou d’un simple croquis, elle permet de placer rapidement l’installation électrique, de relier les commandes aux éclairages, de présenter un plan propre au client, d’exporter un PDF et d’imprimer les étiquettes du tableau.

> Ce n’est pas un logiciel d’architecte : les plans produits sont des **plans simplifiés destinés à l’implantation électrique**.

---

## Sommaire

- [Fonctions](#fonctions)
- [Configurateur de tableau 3D](#configurateur-de-tableau-3d)
- [Installation locale](#installation-locale)
- [Build et tests](#build-et-tests)
- [GitHub Pages](#github-pages)
- [PWA et installation](#pwa-et-installation)
- [Stockage local et sauvegarde](#stockage-local-et-sauvegarde)
- [Impression](#impression)
- [Bluetooth](#bluetooth)
- [Modèles d’étiquettes](#modèles-détiquettes)
- [Croquis → Plan](#croquis--plan)
- [Ajouter des symboles](#ajouter-des-symboles)
- [Structure du projet](#structure-du-projet)
- [Limites et fonctions expérimentales](#limites-et-fonctions-expérimentales)

---

## Fonctions

| Domaine | Ce qui fonctionne |
| --- | --- |
| **Chantiers** | Création (client, adresse, ville, téléphone, email, notes, date, étage), recherche, duplication, suppression avec confirmation, plusieurs plans par chantier (RDC, Étage 1, Garage…), projet de démonstration « Maison Démo », tour guidé au premier lancement |
| **Import du plan** | Photo (appareil photo), scan (redressement + noir et blanc), image JPG / JPEG / PNG / WEBP, PDF (choix de la page), plan vierge « Dessiner rapidement », croquis → plan. Images réduites à ≈ 2400 px et compressées en WebP (JPEG si WebP indisponible) |
| **Scanner** | 4 poignées aux coins avec loupe, redressement de perspective, rotation 90° et rotation fine, luminosité, contraste, niveaux de gris, noir et blanc (seuillage adaptatif), amélioration automatique, détection automatique des bords (OpenCV.js), réinitialisation |
| **Plans du chantier** | Onglets en haut de l’éditeur : un toucher pour passer d’un plan à l’autre (RDC, Étage 1, Étage 2, Garage…). Bouton **+** : nommer le nouveau plan (noms proposés, nom libre accepté, doublons refusés), puis plan vierge ou import d’un fond (photo, PDF, croquis). Toucher l’onglet actif : renommer, déplacer à gauche / à droite, supprimer. Bouton « Gérer les plans » : liste complète avec réorganisation |
| **Éditeur** | React-Konva : pincer pour zoomer (20 % → 800 %), 2 doigts pour déplacer, molette, boutons +, −, adapter à l’écran, 100 %. Murs (tracé point par point, aimantation angles / extrémités), portes, fenêtres, pièces, textes, flèches, cercles, rectangles, crayon, mesures, échelle (point A, point B, distance réelle) |
| **Symboles** | 156 symboles génériques vectoriels (prises, réseau, commandes, éclairage, ventilation, chauffage, électroménager, buanderie, sécurité, domotique, portail / extérieur, tableau, divers), recherche, filtres, favoris, récents. Prises dessinées comme sur les plans de bâtiment (2P+T, double, commandée, étanche, RJ45, TV) ; détecteurs de mouvement / de présence et écran domotique mural. Déplacer, tourner, redimensionner, dupliquer (+1 décalé de 20 px), supprimer, propriétés (pièce, circuit, n°, disjoncteur, section, hauteur, commentaire, couleur) |
| **Symboles fixes** | Un symbole posé reste fixe : un toucher le sélectionne (contour orange), il se déplace alors au doigt ; toucher ailleurs le désélectionne. Déplacer le plan, zoomer ou tourner l’écran ne déplace jamais un symbole. 1 toucher = 1 symbole (aucun doublon) |
| **Bande LED** | Outil *Bande LED* : toucher le départ, glisser le doigt, relâcher pour poser un angle, continuer le long des murs (accroche sur la face des murs et dans les angles) ; toucher le départ ferme le contour (tour d’une chambre). Ensuite : poignées aux extrémités et aux angles (allonger / raccourcir), « + » pour ajouter un angle, double toucher pour retirer un point, déplacement d’un bloc, Prolonger, couleur, texte. Longueur en mètres (si échelle), légende et PDF |
| **Aimantation** | Prises, interrupteurs, appliques… s’aimantent au mur le plus proche et s’orientent automatiquement (distance réglable, 15 px par défaut, vibration si disponible) |
| **Placement rapide** | Mode répétition / « placer plusieurs » : choisir un symbole puis toucher le plan autant de fois que nécessaire, bouton TERMINER |
| **Liaisons** | Bouton RELIER : courbes de Bézier pointillées qui suivent les symboles. Types Commande (orange), Circuit (bleu), Information (gris) ; couleur, épaisseur, pointillés, courbure ; groupes « Commande N » (va-et-vient 1 + 2 → même plafonnier) |
| **Calques** | Plan original, plan reconstruit, symboles, liaisons, annotations, mesures : visibles / masqués, verrouillables ; opacité du plan original |
| **Historique** | Annuler / rétablir (150 actions), copier / coller, raccourcis Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y, Suppr, Ctrl+D, R, Échap |
| **Légende** | Construite automatiquement à partir des symboles présents (avec quantités) |
| **Aperçu client** | Plein écran sans grille ni poignées : plan, symboles, liaisons, légende, titre ; partage d’une image PNG |
| **Export PDF** | A4 / A3, portrait / paysage, marges, titre, chantier, client, date, adresse, légende, notes, liaisons, plan original, plan reconstruit, logo. **PDF vectoriel** (pdf-lib). Aperçu, export, impression, partage |
| **Configurateur de tableau** | Vue technique « Schéma tableau » (repère au-dessus, appareil Legrand / Schneider / Hager avec son calibre, étiquette dessous, modules libres en gris) et « Vue coffret », plusieurs tableaux par projet, références officielles, glisser-déposer sur la grille DIN, numérotation, réserves, totaux configurables, impression du schéma et des étiquettes, PDF, PNG. Voir [Configurateur de tableau 3D](#configurateur-de-tableau-3d) |
| **Tableau** | Rangées, circuits (n°, nom, protection, section, modules, pictogramme), différentiels, réserves, import des circuits depuis le plan, renumérotation |
| **Étiquettes** | Éditeur simple : réglages à gauche, **aperçu en direct** à droite (en haut sur téléphone). Marque (Legrand, Schneider, Hager), modèle (13 ou 18 modules, modèles personnalisés), largeur d’un module, hauteur, modules par ligne, nombre de lignes, texte de chaque case, taille et alignement du texte, ajouter / supprimer une case, largeur d’une case, dupliquer une ligne, réorganiser les cases. Texte ajusté automatiquement (réduction, 2 lignes max, jamais hors de la case) |
| **Impression** | Impression système (AirPrint / Wi-Fi), PDF, aperçu taille réelle avec règle graduée, calibration imprimante (bande test 100 mm), profils d’imprimante, Bluetooth direct expérimental (Web Bluetooth + ESC/POS) |
| **Hors connexion** | Après la première ouverture : chantiers, plan, symboles, liaisons, étiquettes, PDF fonctionnent sans internet (service worker) |

---

## Configurateur de tableau 3D

Accès : carte **Tableaux électriques 3D** de l’accueil (`/tableaux`), ou bouton **Configurateur 3D** de l’écran *Tableau électrique* d’un chantier. L’ancien éditeur d’étiquettes (`/labels`) reste disponible.

Un **projet** (ex. *Maison Dupont*) contient un ou plusieurs **tableaux** (*TABLEAU PRINCIPAL*, *TABLEAU GARAGE*, *TABLEAU ÉTAGE*…) : barre des tableaux sous l’en-tête (ajouter, renommer, dupliquer, supprimer). Projets enregistrés automatiquement, sauvegarde / ouverture d’un fichier `.mgtableau`.

### Deux vues, une seule source de données

- **Schéma tableau** (vue principale, technique, face à face) : pour chaque rangée, le **repère** du circuit au-dessus de l’appareil (texte libre : 1, 14, 5, X…), l’appareil de la marque avec son calibre, l’**étiquette** (désignation) dessous, les **modules libres en gris**, les **réserves** hachurées « RÉSERVE ». À gauche de chaque rangée : RANGÉE n, total selon la règle choisie, calibre du différentiel, modules libres. En haut : *TABLEAU PRINCIPAL - 3 rangées de 13 modules - 20,5 % libre = 8 modules* et le détail (modules utilisés / libres / réservés, alerte si la réserve minimale choisie n’est pas respectée).
- **Vue coffret** : le même tableau dans son coffret (3D légère, porte-étiquettes, rail DIN).

Ajouter, déplacer ou modifier un appareil dans une vue le met à jour dans l’autre.

### Construire le tableau

- **Bibliothèque** par marque (Protection, Disjoncteurs, Commande & automatismes, Prises modulaires, Obturateurs & réserves) : glisser-déposer sur la grille (places libres en vert, silhouette verte ou rouge), ou toucher l’appareil puis l’emplacement, ou « + » (premier emplacement libre).
- **Emplacement occupé** : *Décaler les appareils suivants*, *Remplacer l’emplacement* ou *Annuler*. Supprimer laisse l’emplacement libre ; *Compacter la rangée* resserre les appareils.
- **Quel circuit ?** à la pose d’un disjoncteur (facultatif, désactivable) : Four, Plaque, Lave-vaisselle, Prises, Éclairage… ou *Autre…* pour écrire son propre texte.
- **Édition directe** : toucher le texte sous l’appareil ou le repère au-dessus ouvre *Nom du circuit / Repère / Nom court / Icône*.
- **Fiche de l’appareil** : type, marque, gamme, référence, calibre (modifiable), largeur (modifiable si non fixée par une référence), rangée, position, repère, étiquette, icône, source officielle ; actions *Modifier, Déplacer, Dupliquer, Supprimer, Étiquette*.
- **Emplacement libre** : *Réserver* (1 module ou tout l’espace libre) ou poser directement un disjoncteur courant.
- **Circuits** : liste « 01 — Plaque induction — 32 A » avec recherche (taper *Four* sélectionne le circuit) ; *Numéroter les circuits* (1, 2, 3…) ou repères libres non séquentiels.
- **Étiquettes** : modes *Professionnel* (texte), *Visuel* (icône + texte), *Icône* ; icône facultative ; nom court proposé (« Prises cuisine » → *PC CUISINE*, jamais imposé) ; texte long : réduction légère puis retour à la ligne (3 lignes), jamais de texte minuscule.
- **Totaux de rangée** : aucun calcul par défaut ; règle au choix *Somme des calibres* ou *Somme × coefficient* (ex. 0,5). L’application n’en déduit aucune conformité.
- Tablette / ordinateur : bibliothèque (ou circuits) à gauche, tableau au centre, propriétés à droite. Téléphone : tableau pleine largeur à une échelle lisible (défilement horizontal), boutons *Appareil*, *Circuits*, *Modifier*. Toucher court = sélection, appui long = déplacement, pincer / molette = zoom ; le zoom et le défilement ne déplacent jamais un appareil. Annuler / rétablir pour toutes les opérations.

### Impression et exports

- **Imprimer schéma tableau** (ce tableau ou tous) : aperçu à l’échelle avec *Zoom, Imprimer, PDF, Annuler*.
- **Imprimer étiquettes** : uniquement les bandeaux nécessaires, dimensions réelles du support (largeur de module, hauteur, taille du texte, repère dans le coin), texte noir sur fond blanc, calibration par règle de 50 mm.
- **PNG haute résolution** du schéma, **dossier PDF complet** (schémas, nomenclature, liste des circuits, étiquettes), sauvegarde du projet.

### Données fabricants (jamais inventées)

Chaque marque a son propre fichier : [`legrand.json`](src/features/panel3d/data/manufacturers/legrand.json), [`schneider.json`](src/features/panel3d/data/manufacturers/schneider.json), [`hager.json`](src/features/panel3d/data/manufacturers/hager.json) (coffrets et appareils, avec `sourceName`, `sourceUrl`, `lastVerified`).

| Gamme | Coffrets de la base | Dimensions L × H × P |
| --- | --- | --- |
| Legrand Drivia 13 modules | 401211 → 401214 (1 à 4 rangées) | 250 × 250 / 375 / 500 / 625 × 103,5 mm |
| Legrand Drivia 18 modules | 401224 (4 rangées, entraxe 125 mm) | 355 × 625 × 103,5 mm |
| Schneider Resi9 13 / 18 modules | R9H13401 → R9H13404, R9H18401 → R9H18404 | *Données techniques non renseignées* |
| Hager Gamma+ 13 modules | GD113A → GD413A (1 à 4 rangées) | 250 × 250 / 375 / 500 / 625 × 103 mm |
| Hager Gamma+ 18 modules | GD418A (4 rangées) | 355 × 625 × 103 mm |

Règles appliquées par le code :

- une dimension ou une référence absente de la base s’affiche **« Données techniques non renseignées »** (ou « Référence non renseignée ») ; aucune valeur approchée, aucune extrapolation, aucune reprise des cotes d’une autre marque ;
- sans dimensions officielles (Resi9), le coffret est dessiné en **vue schématique** (grille modulaire seule, sans cote) ;
- en 18 modules, seules les configurations vérifiées sont proposées (4 rangées) ;
- appareils : références **vérifiées sur le site officiel** de chaque fabricant (page produit enregistrée dans `sourceUrl`) :

| Appareil | Legrand | Schneider Electric | Hager |
| --- | --- | --- | --- |
| Disjoncteur 1P+N courbe C 1 module | DNX³ 4500 : 406771 (2 A), 406772 (6 A), 406773 (10 A), 406774 (16 A), 406775 (20 A), 406776 (25 A), 406777 (32 A), 406873 (40 A) | Resi9 XP : R9PFC602, R9PFC606, R9PFC610, R9PFC616, R9PFC620, R9PFC625, R9PFC632 | MFN702, MFN706, MFN710, MFN716, MFN720, MFN725, MFN732 |
| Interrupteur différentiel 2P 30 mA | DX³-ID : 411632 (40 A AC), 411617 (40 A A), 411506 (63 A AC), 411556 (63 A A), 411592 (63 A F) | R9PRA263 (63 A A), R9PRF263 (63 A Fsi) | CDC764F (63 A AC), CDA765F (63 A A), CDF763F (63 A F) |
| Prise modulaire 2P+T 16 A | 004280 (2,5 modules) | R9PCS616 | SNS216 |

- les autres appareils (télérupteur, contacteurs, parafoudre, horloge…) gardent la largeur modulaire standard (1 module = 18 mm) et la mention « Référence non renseignée » tant qu’ils ne sont pas vérifiés ; leur largeur reste modifiable dans la fiche.

Pour compléter la base : ajouter l’entrée dans le JSON de la marque en renseignant la source officielle (site du fabricant, puis fiche PDF, puis catalogue officiel — jamais une marketplace), puis lancer `npm test` (les tests vérifient notamment qu’aucune dimension n’est copiée d’une marque à l’autre).

---

## Installation locale

Prérequis : **Node.js 22** (ou ≥ 20.19) et npm.

```bash
npm install
npm run dev
```

Ouvrir ensuite : <http://localhost:5173/mg-elec-plans/>

> Le chemin `/mg-elec-plans/` est le chemin de publication par défaut. Il peut être changé avec la variable `BASE_PATH` (ex. `BASE_PATH=/ npm run dev`).

## Build et tests

```bash
npm run build     # vérification TypeScript (strict) + build Vite + service worker PWA
npm run preview   # sert le build : http://localhost:4173/mg-elec-plans/
npm run test      # tests Vitest
```

Les tests couvrent notamment : largeur des étiquettes, conversion mm → points PDF, modèles 13 modules Legrand / Schneider / Hager, calibration imprimante, sérialisation des projets, liaisons entre symboles, aimantation aux murs, historique annuler / rétablir, chemins SVG vectoriels, encodage ESC/POS, homographie du scanner, reconstruction de croquis (avec et sans OpenCV), bandes LED (accroche aux murs, angles, fermeture, longueur, export PDF), nouveaux symboles et éditeur d’étiquettes (cases, lignes, réorganisation, réglages du modèle).

---

## GitHub Pages

Le déploiement est automatique grâce au workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) : à chaque `push` sur `main` (ou lancement manuel), il exécute `npm ci`, les tests, `npm run build`, puis publie le dossier `dist` sur GitHub Pages.

**À faire une seule fois** dans le dépôt GitHub : *Settings → Pages → Build and deployment → Source : **GitHub Actions***.

Le chemin de base est calculé automatiquement à partir du **nom du dépôt** (`BASE_PATH=/<nom-du-repo>/`), l’application fonctionne donc quel que soit ce nom :

| Dépôt | URL |
| --- | --- |
| `mg-elec-plans` | `https://MON-UTILISATEUR.github.io/mg-elec-plans/` |
| `Elec-Plans` (dépôt actuel) | `https://arges25.github.io/Elec-Plans/` |

Le routage utilise `HashRouter` (`#/project/…`) : aucune erreur 404 lors d’un rafraîchissement sur GitHub Pages.

### Envoyer le projet sur un nouveau dépôt `mg-elec-plans`

```bash
git init
git add .
git commit -m "MG Elec & Plans"
git branch -M main
git remote add origin https://github.com/MON-UTILISATEUR/mg-elec-plans.git
git push -u origin main
```

---

## PWA et installation

- Manifest : nom **MG Elec & Plans**, nom court **MG Elec**, affichage `standalone`, orientation `portrait-primary`, couleur de thème `#111827`, fond `#ffffff`, icônes 192 / 512 / maskable 512.
- Service worker (Workbox via `vite-plugin-pwa`) : toute l’application est mise en cache à la première visite. OpenCV.js (≈ 13 Mo) n’est **pas** pré-chargé : il est mis en cache à sa première utilisation (ou via *Réglages → Croquis → Plan → Préparer*).
- **Mises à jour** : une nouvelle version prend la main dès qu’elle est téléchargée (pas de version « en attente » : sur iPhone, l’application n’est presque jamais complètement fermée). La recherche a lieu au lancement, à chaque retour au premier plan, à la reconnexion et toutes les 30 minutes.
  - Application ouverte : bandeau orange **« Nouvelle version disponible »** → **Mettre à jour** (la sauvegarde en cours est terminée avant le rechargement ; les projets sont conservés), sinon rechargement automatique au prochain retour dans l’application.
  - Pages ouvertes avec une ancienne version (qui ne savent pas se recharger seules) : rechargées par le service worker (`public/sw-takeover.js`).
  - Filet de sécurité : `version.json` (jamais mis en cache) est comparé à la version de l’application ; si le service worker ne récupère pas la version en ligne, **Mettre à jour** efface la copie hors connexion (jamais les projets ni les réglages) et recharge.
  - Après chaque mise à jour, le message **« Application mise à jour ✓ »** le confirme.
- *Réglages → Application → Mise à jour* : version installée (date de publication et commit) et bouton **Rechercher** pour vérifier à la demande.

### Installation sur iPhone / iPad (Safari)

1. Ouvrir l’URL dans **Safari**.
2. Toucher **Partager**.
3. Choisir **« Sur l’écran d’accueil »**, puis **Ajouter**.

### Installation sur Android (Chrome)

- Toucher **Installer** dans le bandeau « Installer MG Elec & Plans » de l’accueil,
- ou menu ⋮ du navigateur → **Installer l’application**.

L’aide d’installation peut être masquée (« Ne plus afficher ») et réaffichée dans les Réglages.

---

## Stockage local et sauvegarde

- Toutes les données sont stockées **sur l’appareil**, dans IndexedDB (Dexie) : tables `projects`, `plans`, `symbolsPlaced`, `connections`, `circuits`, `panels`, `labels`, `printerProfiles`, `customTemplates`, `settings`.
- **Aucune donnée n’est envoyée sur internet**, aucun compte, aucun suivi.
- Sauvegarde automatique 400 ms après chaque modification (jamais pendant un glisser), indicateur « Enregistré ✓ » / « Sauvegarde… ».
- *Réglages → Stockage → Protéger* demande au navigateur un stockage persistant.
- **Export / import** : chaque chantier s’exporte au format **`.mgeplan`** (JSON : projet, plans et images, symboles, liaisons, tableau, circuits, étiquettes, réglages utiles). L’import crée une copie (nouveaux identifiants). *Réglages → Exporter tous les projets* permet une sauvegarde complète.

> Effacer les données du navigateur supprime les projets : exportez régulièrement vos chantiers importants.

---

## Impression

- **Impression système** : page HTML dimensionnée en millimètres (AirPrint sur iPhone / iPad, imprimantes Wi-Fi, imprimante par défaut).
- **PDF** : PDF vectoriel (plans et étiquettes), téléchargeable, partageable, imprimable.
- **Important** : dans la boîte d’impression, **désactivez « Ajuster à la page »** (échelle 100 %).
- **Aperçu taille réelle** : règle graduée en mm, zoom écran indépendant de la taille imprimée, bouton « TAILLE RÉELLE », calibration facultative de l’écran avec une carte bancaire.
- **Calibration** (*Étiquettes → Calibrer mon imprimante*) : imprimer la bande test (« MG Elec & Plans — TEST 100 mm », règle, trait vertical de 50 mm, 13 cases), mesurer le trait, saisir la longueur mesurée (ex. 98,7 mm). L’application calcule `scaleX = 100 / 98,7` (et `scaleY` si le trait vertical est mesuré). Offset X / Y réglables. La calibration est enregistrée **par imprimante**.

## Bluetooth

L’impression Bluetooth directe utilise **Web Bluetooth** et une architecture de profils (`BluetoothPrinterProfile` : nom, service UUID, caractéristique, protocole, largeur papier, dpi) dans `src/data/bluetoothPrinterProfiles.ts` :

- profil **ESC/POS BLE générique (expérimental)** : impression raster (GS v 0) des étiquettes, tournées le long du rouleau ;
- emplacements prévus pour des imprimantes thermiques ou propriétaires (non pris en charge : pas de protocole inventé).

### Limites Bluetooth des navigateurs

- Web Bluetooth est disponible sur **Chrome / Edge** (Android, Windows, macOS, ChromeOS), en HTTPS.
- Il n’est **pas disponible sur Safari (iPhone / iPad)** ni sur Firefox. Dans ce cas l’application affiche : *« Impression Bluetooth directe non disponible sur ce navigateur. Utilisez l’impression système ou exportez le PDF. »*
- Aucune connexion n’est simulée : en cas d’échec, utilisez l’impression système ou le PDF.

---

## Modèles d’étiquettes

La **seule source** des dimensions est [`src/data/electricalPanelTemplates.ts`](src/data/electricalPanelTemplates.ts) :

| Modèle | Modules | Pas | Largeur |
| --- | --- | --- | --- |
| Legrand Drivia 13 | 13 | 17,5 mm | 227,5 mm |
| Schneider Resi9 13 | 13 | 18 mm | 234 mm |
| Hager Gamma+ 13 | 13 | 17,5 mm | 227,5 mm |
| Legrand Drivia 18 | 18 | 17,5 mm | 315 mm |
| Schneider Resi9 18 | 18 | 18 mm | 324 mm |
| Hager Gamma+ 18 | 18 | 17,5 mm | 315 mm |

La **hauteur d’étiquette (`labelHeightMm`) est une valeur indicative** (12 mm) et non une cote constructeur vérifiée : mesurez votre porte-étiquette.

L’écran **Étiquettes** du tableau permet de tout régler en direct (marque, modèle, largeur d’un module, hauteur, modules par ligne, lignes, texte, taille, alignement, cases). Dans l’application (*Étiquettes tableau → Modèles*) : choisir le fabricant, modifier toutes les dimensions (nombre de modules, largeur module, largeur totale, hauteur, marges, espacement, police, taille, bordure, pictogramme, numéro, alignement, 2 lignes max.), **dupliquer un modèle** pour créer un modèle personnalisé (ex. « Legrand perso garage »), réinitialiser un modèle fabricant.

---

## Croquis → Plan

Workflow : 1. photo du croquis → 2. analyse → 3. plan proposé → 4. correction → 5. implantation électrique.

- **Reconstruction automatique locale** (aucune image envoyée) avec **OpenCV.js** : niveaux de gris, flou, seuillage adaptatif, fermeture / dilatation, extraction des traits horizontaux et verticaux, HoughLinesP ; puis post-traitement : fusion des traits proches, alignement, fermeture des angles, suppression des petits traits isolés, détection approximative des ouvertures. Sans OpenCV (hors connexion), une détection simplifiée en TypeScript prend le relais (Web Worker).
- Le résultat est toujours modifiable : déplacer / allonger / raccourcir / supprimer un mur, tracer de nouveaux murs **par-dessus la photo**, ajouter portes, fenêtres et pièces, afficher / masquer le croquis, régler son opacité (0 → 100 %), le verrouiller.
- Message affiché : *« Plan simplifié généré automatiquement. Vérifiez les murs et ouvertures avant utilisation. »*
- `src/services/planReconstruction/remoteAIPlanReconstruction.ts` prépare le branchement d’un futur service d’IA distant : **désactivé par défaut**, jamais présenté comme « IA » tant qu’aucun service réel n’est connecté.

---

## Ajouter des symboles

Toute la bibliothèque est dans [`src/data/electricalSymbols.ts`](src/data/electricalSymbols.ts). Chaque symbole est dessiné par des **primitives vectorielles** (chemins SVG, cercles, textes) dans une boîte 40 × 40 centrée, le dos des symboles muraux vers le haut. Les mêmes primitives servent à l’éditeur (Konva), aux vignettes SVG, au PDF vectoriel et aux pictogrammes d’étiquettes.

```ts
prise({
  id: 'prise-16a-usb',                // identifiant unique
  name: 'Prise 16A + USB',
  subCategory: 'Prises USB',
  shapes: socket('USB'),              // briques disponibles dans src/data/symbolShapes.ts
  keywords: ['usb', 'chargeur'],
  description: 'Prise 2P+T avec chargeur USB',
}),
```

---

## Structure du projet

```text
src/
  components/
    layout/        en-têtes, navigation projet, logo, indicateur de sauvegarde
    ui/            boutons 44 px, champs, feuilles (bottom sheets), dialogues, notifications
    editor/        canevas Konva, calques, outils, barres mobiles, propriétés, légende
    symbols/       bibliothèque, vignettes SVG
    labels/        aperçu des bandes, édition des circuits
    scanner/       recadrage 4 coins + loupe
    projects/      cartes de chantier
    onboarding/    tour guidé, aide à l’installation
  features/
    panel3d/       configurateur de tableau 3D :
      data/          bases fabricants (JSON par marque) + catalogue
      engine/        placement (grille 0,5 module), opérations (décaler, compacter, numéroter,
                     occupation, totaux), géométries du schéma et du coffret, nomenclature
      render/        schéma technique et coffret en SVG, appareils dessinés par marque, icônes
      store/         éditeur (historique annuler / rétablir), fabrique de projets
      persistence/   projets enregistrés (IndexedDB)
      print/         étiquettes en mm, feuille « Schéma tableau », calibration 50 mm, impression, PDF, PNG
      ui/            pages, onglets, bibliothèque, tableau interactif, propriétés, étiquettes
  pages/           HomePage, NewProjectPage, ImportPlanPage, ScannerPage, SketchToPlanPage,
                   PlanEditorPage, SymbolLibraryPage, ElectricalPanelPage, LabelsPage,
                   LabelPreviewPage, TemplatesPage, TemplateEditorPage, PrintCalibrationPage,
                   PrintersPage, ExportPage, SettingsPage, AboutPage…
  store/           Zustand : éditeur (historique), réglages, vue, notifications, dialogues
  services/        pdf/ (import PDF.js, export pdf-lib), labels/, printerService/
                   (systemPrint, pdfPrint, webBluetoothPrint, escpos), planReconstruction/
                   (localPlanReconstruction, remoteAIPlanReconstruction, OpenCV), imageProcessing,
                   projectTransfer (.mgeplan)
  database/        Dexie (IndexedDB) et dépôts
  data/            electricalSymbols, electricalPanelTemplates, bluetoothPrinterProfiles, démo
  utils/           géométrie, unités, chemins SVG, mise en page des étiquettes, calibration…
  hooks/           sauvegarde automatique, raccourcis clavier, requêtes réactives
  workers/         détection de croquis sans OpenCV
  pwa/             installation, mises à jour du service worker
  types/           types TypeScript stricts (Project, Plan, Wall, Door, Window, PlacedSymbol…)
public/            logo.svg, icônes PWA (192, 512, maskable)
scripts/           génération des icônes PNG depuis le logo SVG
```

---

## Limites et fonctions expérimentales

- **Croquis → Plan** : expérimental. Donne de bons résultats sur des croquis contrastés aux murs droits ; les ouvertures sont détectées de façon approximative. Toujours vérifier et corriger.
- **Bluetooth direct** : expérimental, dépend du navigateur (pas d’iOS) et de l’imprimante (ESC/POS BLE uniquement).
- **Configurateur de tableau** : références vérifiées pour les disjoncteurs, différentiels 63 A et prises modulaires ; les autres appareils affichent « Référence non renseignée ». Coffrets Schneider Resi9 en vue schématique tant que leurs dimensions officielles ne sont pas saisies. Les appareils sont des dessins vectoriels inspirés des produits (la marque est écrite en texte simple, sans logo).
- **Pas de contrôle normatif** : l’application stocke des informations électriques mais **ne vérifie pas la conformité NF C 15-100** et n’affiche jamais « installation conforme ». Toute aide future sera présentée comme *« Aide indicative. Validation par l’électricien. »*
- Les hauteurs d’étiquettes fabricants sont indicatives et doivent être mesurées.

---

Technologies : React 19, TypeScript (strict), Vite, Tailwind CSS 4, Zustand, Dexie (IndexedDB), Konva / React-Konva, PDF.js, pdf-lib, OpenCV.js, Lucide, vite-plugin-pwa (Workbox), Vitest.
