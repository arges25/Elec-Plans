# MG Elec & Plans

**Vos plans électriques, simplement.**

MG Elec & Plans est une application web mobile (PWA installable) destinée aux électriciens : à partir d’un plan, d’un scan, d’un PDF ou d’un simple croquis, elle permet de placer rapidement l’installation électrique, de relier les commandes aux éclairages, de présenter un plan propre au client, d’exporter un PDF et d’imprimer les étiquettes du tableau.

> Ce n’est pas un logiciel d’architecte : les plans produits sont des **plans simplifiés destinés à l’implantation électrique**.

---

## Sommaire

- [Fonctions](#fonctions)
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
| **Chantiers** | Création (client, adresse, ville, téléphone, email, notes, date, étage), recherche, duplication, suppression avec confirmation, plusieurs niveaux par chantier, projet de démonstration « Maison Démo », tour guidé au premier lancement |
| **Import du plan** | Photo (appareil photo), scan (redressement + noir et blanc), image JPG / JPEG / PNG / WEBP, PDF (choix de la page), plan vierge « Dessiner rapidement », croquis → plan. Images réduites à ≈ 2400 px et compressées en WebP (JPEG si WebP indisponible) |
| **Scanner** | 4 poignées aux coins avec loupe, redressement de perspective, rotation 90° et rotation fine, luminosité, contraste, niveaux de gris, noir et blanc (seuillage adaptatif), amélioration automatique, détection automatique des bords (OpenCV.js), réinitialisation |
| **Éditeur** | React-Konva : pincer pour zoomer (20 % → 800 %), 2 doigts pour déplacer, molette, boutons +, −, adapter à l’écran, 100 %. Murs (tracé point par point, aimantation angles / extrémités), portes, fenêtres, pièces, textes, flèches, cercles, rectangles, crayon, mesures, échelle (point A, point B, distance réelle) |
| **Symboles** | 154 symboles génériques vectoriels (prises, réseau, commandes, éclairage, ventilation, chauffage, électroménager, buanderie, sécurité, domotique, portail / extérieur, tableau, divers), recherche, filtres, favoris, récents. Déplacer, tourner, redimensionner, dupliquer (+1 décalé de 20 px), supprimer, propriétés (pièce, circuit, n°, disjoncteur, section, hauteur, commentaire, couleur) |
| **Aimantation** | Prises, interrupteurs, appliques… s’aimantent au mur le plus proche et s’orientent automatiquement (distance réglable, 15 px par défaut, vibration si disponible) |
| **Placement rapide** | Mode répétition / « placer plusieurs » : choisir un symbole puis toucher le plan autant de fois que nécessaire, bouton TERMINER |
| **Liaisons** | Bouton RELIER : courbes de Bézier pointillées qui suivent les symboles. Types Commande (orange), Circuit (bleu), Information (gris) ; couleur, épaisseur, pointillés, courbure ; groupes « Commande N » (va-et-vient 1 + 2 → même plafonnier) |
| **Calques** | Plan original, plan reconstruit, symboles, liaisons, annotations, mesures : visibles / masqués, verrouillables ; opacité du plan original |
| **Historique** | Annuler / rétablir (150 actions), copier / coller, raccourcis Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y, Suppr, Ctrl+D, R, Échap |
| **Légende** | Construite automatiquement à partir des symboles présents (avec quantités) |
| **Aperçu client** | Plein écran sans grille ni poignées : plan, symboles, liaisons, légende, titre ; partage d’une image PNG |
| **Export PDF** | A4 / A3, portrait / paysage, marges, titre, chantier, client, date, adresse, légende, notes, liaisons, plan original, plan reconstruit, logo. **PDF vectoriel** (pdf-lib). Aperçu, export, impression, partage |
| **Tableau** | Rangées, circuits (n°, nom, protection, section, modules, pictogramme), différentiels, réserves, import des circuits depuis le plan, renumérotation |
| **Étiquettes** | Legrand Drivia 13, Schneider Resi9 13, Hager Gamma+ 13 et modèles personnalisés ; texte ajusté automatiquement (réduction, 2 lignes max, jamais hors de la case) ; édition par étiquette |
| **Impression** | Impression système (AirPrint / Wi-Fi), PDF, aperçu taille réelle avec règle graduée, calibration imprimante (bande test 100 mm), profils d’imprimante, Bluetooth direct expérimental (Web Bluetooth + ESC/POS) |
| **Hors connexion** | Après la première ouverture : chantiers, plan, symboles, liaisons, étiquettes, PDF fonctionnent sans internet (service worker) |

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

Les tests couvrent notamment : largeur des étiquettes, conversion mm → points PDF, modèles 13 modules Legrand / Schneider / Hager, calibration imprimante, sérialisation des projets, liaisons entre symboles, aimantation aux murs, historique annuler / rétablir, chemins SVG vectoriels, encodage ESC/POS, homographie du scanner et reconstruction de croquis (avec et sans OpenCV).

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
- Une notification propose de recharger quand une nouvelle version est disponible.

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

La **hauteur d’étiquette (`labelHeightMm`) est une valeur indicative** (12 mm) et non une cote constructeur vérifiée : mesurez votre porte-étiquette.

Dans l’application (*Étiquettes tableau → Modèles*) : choisir le fabricant, modifier toutes les dimensions (nombre de modules, largeur module, largeur totale, hauteur, marges, espacement, police, taille, bordure, pictogramme, numéro, alignement, 2 lignes max.), **dupliquer un modèle** pour créer un modèle personnalisé (ex. « Legrand perso garage »), réinitialiser un modèle fabricant.

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
- **Pas de contrôle normatif** : l’application stocke des informations électriques mais **ne vérifie pas la conformité NF C 15-100** et n’affiche jamais « installation conforme ». Toute aide future sera présentée comme *« Aide indicative. Validation par l’électricien. »*
- Les hauteurs d’étiquettes fabricants sont indicatives et doivent être mesurées.

---

Technologies : React 19, TypeScript (strict), Vite, Tailwind CSS 4, Zustand, Dexie (IndexedDB), Konva / React-Konva, PDF.js, pdf-lib, OpenCV.js, Lucide, vite-plugin-pwa (Workbox), Vitest.
