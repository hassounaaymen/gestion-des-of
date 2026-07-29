# Gestion des Ordres de Fabrication — Béton Préfabriqué

Application web de gestion du cycle complet des ordres de fabrication (OF)
de produits en béton préfabriqué, avec séparation stricte des responsabilités
Production / Qualité / Gestion de Production et **intégration native à
Microsoft Dynamics NAV / Business Central**.

## Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS** + composants type shadcn/ui · **Framer Motion**
- **Prisma ORM** + **SQLite**
- **TanStack Query / Table** · **Recharts** · **Lucide Icons** · **Zod**
- Auth **JWT** (jose) + **bcrypt**, **RBAC** à permissions fines, historique immuable

## Démarrage

```bash
npm install
npm run db:reset   # base SQLite + utilisateurs + plans de contrôle qualité
npm run erp:sync   # importe le référentiel réel depuis Business Central
npm run dev
```

Application : http://localhost:3000

### Comptes (mot de passe : `Password123!`)

| Identifiant   | Rôle                            |
| ------------- | ------------------------------- |
| admin         | Administrateur (technique)      |
| direction     | Direction Générale              |
| production    | Responsable Production          |
| qualite       | Responsable Qualité             |
| gestion       | Responsable Gestion Production  |
| consultation  | Consultation                    |

## Positionnement vis-à-vis de Dynamics NAV 2018

Le module Production de NAV est puissant mais trop lourd pour le personnel
d'atelier. Cette application est la **couche opérationnelle simple** au-dessus :

- **Production et Qualité** y travaillent avec des écrans dédiés à leur métier ;
- elles **communiquent sur l'ordre** (fil d'échanges + notifications) au lieu
  de se transmettre des fichiers ;
- la **Direction Générale** supervise les deux services depuis un rôle dédié
  (lecture intégrale, indicateurs, écarts, exports) sans pouvoir saisir à leur place ;
- le **référentiel reste maître dans NAV** : articles et magasins sont importés
  en lecture seule, jamais modifiés ici.

### État de l'intégration NAV

| Canal | Port | Statut |
| ----- | ---- | ------ |
| OData V4 | 6048 | ✅ connecté (Item, ItemLedgerEntries) |
| SOAP | 6047 | ✅ joignable, 67 services publiés |

⚠️ **Le module Production de NAV n'est pas publié** sur ce serveur : ni
`Production Order`, ni `Work Center`, ni `Machine Center`, ni `Routing`,
ni `Production BOM`, ni `Output Journal`. Pour pousser les OF vers NAV,
demander à l'administrateur NAV de publier ces pages dans la table
**Web Services** (onglet OData). Le connecteur (`src/services/erp.service.ts`)
est prêt à les consommer.

## Intégration ERP (Business Central)

Configuration dans `.env` (non versionné) :

```
ERP_BASE_URL="http://<serveur>:<port>/<instance>/ODataV4"
ERP_COMPANY="BEST BETON"
ERP_USER="…"
ERP_PASSWORD="…"
```

L'authentification est **Basic (NavUserPassword)**. La synchronisation
(`npm run erp:sync`, ou le bouton « Synchroniser l'ERP ») importe :

- **Articles** — entité `Item` : `No`, `Description`, `Inventory_Posting_Group`
  (famille), `Gen_Prod_Posting_Group` (catégorie), `Base_Unit_of_Measure`.
  La pagination OData (`@odata.nextLink`) est suivie automatiquement.
- **Magasins** — reconstitués à partir des `Location_Code` distincts des
  écritures article (`ItemLedgerEntries`), l'entité `Location` n'étant pas
  exposée sur ce serveur.

Ces données sont **strictement en lecture seule** dans l'application.

### Enrichissements dérivés du référentiel

| Donnée ERP              | Déduction applicative                                    |
| ----------------------- | -------------------------------------------------------- |
| `Gen_Prod_Posting_Group` | Nature (produit fini / semi-fini / MP / consommable / PDR) |
| `PF-QUADRA`, `PF-VIFESA`… | **Ligne de production** (atelier pré-rempli sur l'OF)      |
| Nature PF ou SF          | **Fabricable** — seuls ces articles sont éligibles à un OF |
| `MAGPF-*` / `MAGMP-*`    | Type de magasin (produits finis / matières premières)      |
| Désignation article      | **Cotes nominales** pour le contrôle dimensionnel          |

## Contrôle qualité piloté par plan de contrôle

Chaque famille de produit possède un **plan de contrôle** (`QualitySpec`)
inspiré des référentiels du béton préfabriqué (EN 771-3, EN 1338/1339/1340,
EN 1916/1917, EN 1168, EN 15037, EN 14844) :

- **Cotes dimensionnelles** — tolérance ± appliquée autour de la **cote
  nominale extraite de la désignation ERP**.
  Ex. `BLOC Creux 10X20X40 cm` → 400 / 200 / 100 mm, tolérance ±3 mm.
- **Résistance à la compression** — minimum absolu, point **critique**.
- **Humidité** — maximum absolu.

Pendant la saisie, chaque mesure est évaluée en direct (conforme / hors
tolérance, avec l'écart au nominal) et le moteur **propose une décision**
que le contrôleur reste libre d'appliquer.

## Réconciliation Production ↔ Qualité

La Production **déclare** ce qu'elle a fabriqué ; la Qualité **valide
indépendamment en quantités** (contrôlée / conforme / non conforme).
L'écart entre les deux déclarations est tracé et remonté.

Exemple : la Production déclare 20 dalots bons ; la Qualité en valide
15 conformes et 5 non conformes →

| Déclaration | Total | Bon / Conforme | Rebut / Refusé |
| ----------- | ----- | -------------- | -------------- |
| Production  | 20    | 20             | 0              |
| Qualité     | 20    | 15             | 5              |
| **Écart**   | 0     | **−5**         | **+5**         |

→ taux de conformité 75 %, **écart majeur** (25 % de la production),
décision « Conforme partiel », et **fiche de non-conformité créée
automatiquement** pour les 5 unités refusées.

La page **Écarts Production / Qualité** liste tous les OF où les deux
déclarations divergent, avec le taux de concordance global. Un écart
supérieur à 5 % de la quantité produite est classé **majeur**.

## Garde-fous production

- Cohérence obligatoire : `quantité bonne + rebut = quantité produite`
  (contrôle en direct + correction assistée).
- **Cause de rebut obligatoire** dès qu'un rebut est saisi, choisie dans un
  **référentiel fermé classé selon les 5M** (diagramme d'Ishikawa) :
  Main d'œuvre · Matière · Matériel · Méthode · Milieu.
  Le sélecteur regroupe les causes par axe ; le code, le libellé et l'axe
  sont enregistrés, ce qui rend le Pareto des défauts et l'analyse de cause
  racine réellement exploitables (le texte libre fragmentait les catégories).
  Le référentiel (`RejectCause`) est en base : ajustable sans redéploiement.
- Indicateurs calculés à la saisie : rendement, taux de rebut, avancement
  vs prévu, cadence horaire sur temps machine.

## Planning et planification de production

**Filtres** : fenêtre de dates libre (Du / Au) et **usine**. Les filtres sont
conservés dans la navigation par périodes et repris tels quels dans l'export
PDF (jusque dans le nom du fichier).

### Usines

Chaque unité de production est bâtie autour d'une presse et porte son nom.
La correspondance est dans `src/lib/usines.ts` :

| Magasin BC | Usine |
| ---------- | ----- |
| `MAGPF-U1` | QUADRA |
| `MAGPF-U2` | VIFESA |
| `MAGPF-U3` | PRENSOLAND |
| `MAGPF-U4` | COMPACTA |
| `MAGPF-U5` | FERAILLAGE |
| `MAGPF-U6` | DEMA |

Ces six noms recoupent exactement les lignes de production déduites du groupe
compta produit de l'ERP (`PF-QUADRA`, `PF-VIFESA`, …) : le planning parle donc
le même vocabulaire côté **atelier** et côté **usine**.

Le rapprochement code magasin → unité tolère les variantes rencontrées
(`MAGPF-U1`, `MAGU1`, `MAG-U1`, `MGPF-U1`).

**Fiche planning PDF** (paysage) : le diagramme de Gantt est redessiné pour
l'impression — bandes par atelier, barres colorées par étape, `!!` urgent /
`!` prioritaire, légende, détail des ordres, OF non planifiés et cartouche
de visas. Destinée à être affichée en atelier.

**Vue de charge** par atelier / ligne sur un horizon glissant (7 à 28 jours),
sous forme de diagramme de Gantt : chaque OF est une barre positionnée sur
`dateDebut → dateFinPrev`, colorée selon l'étape du workflow et **rouge si
en retard**. La barre de progression de l'atelier compare charge réalisée et
charge prévue. Les OF sans dates sont isolés dans « OF non planifiés ».

**Planification** (permission `planning:write` — Production et Gestion de
Production uniquement ; la Direction supervise sans opérer) :

- bouton **Planifier** sur chaque OF non planifié, **Replanifier** au survol
  d'une barre du Gantt, et depuis la fiche de l'OF ;
- affectation des dates, de l'atelier, de l'équipe et du chef d'équipe ;
- l'**atelier est pré-rempli** avec la ligne de production ERP de l'article
  (`PF-QUADRA` → `QUADRA`), et l'auto-complétion propose les lignes connues ;
- **priorité** (basse / normale / haute / urgente) : à date de début égale,
  l'urgence passe devant dans la file de l'atelier ; les OF urgents (⚑) et
  hautement prioritaires (▲) sont marqués sur le Gantt ;
- garde-fous : fin ≥ début, et les deux bornes vont de pair ;
- un OF clôturé ou annulé ne peut plus être planifié ;
- chaque planification est **horodatée, signée**, journalisée
  (`PLAN` / `REPLAN`) et **notifiée à l'atelier**.

**Création d'un OF depuis le planning** (permission `order:create` —
Responsable Production) : chaque case du Gantt (atelier × jour) est un
créneau cliquable. Un clic ouvre la création d'ordre avec l'**atelier et la
date déjà renseignés** ; il ne reste qu'à choisir l'article, le magasin et la
quantité. L'ordre naît donc **déjà planifié** (`plannedAt` / `plannedBy`
renseignés automatiquement). Trois points d'entrée : créneau du Gantt,
« + » de la ligne d'atelier, et bouton « Nouvel OF » de l'en-tête.

## Rapports & exports

| Document | Format | Contenu |
| -------- | ------ | ------- |
| Fiche planning | PDF paysage | Gantt par atelier, détail des OF, non planifiés, visas |
| Rapport de synthèse | PDF | KPI, performance atelier/équipe, Pareto, axes 5M, écarts |
| Fiche d'ordre de fabrication | PDF | Production, qualité, écarts, NC, échanges, **visas** |
| Registre des OF | Excel | Toutes colonnes production + qualité + écart, totaux |
| Écarts Production/Qualité | Excel | Confrontation détaillée + synthèse |
| Non-conformités | Excel | Registre complet |

Les classeurs Excel sont mis en forme (en-tête société, filtres automatiques,
volets figés, totaux) et les écarts sont signalés en rouge.
Les PDF portent l'en-tête société, la pagination et un cartouche de visas
Production / Qualité / Direction.

## Architecture

```
src/
  app/            Pages (App Router) + API Routes
    (app)/        Espace applicatif protégé
    api/          Controllers (auth, orders, erp, articles, stores)
  features/       Composants métier (orders, erp)
  components/     UI réutilisable (ui/, dashboard/, layout)
  services/       Logique métier (order, quality, dashboard, erp)
  lib/            prisma, session/JWT, rbac, audit, validations,
                  dimensions (cotes nominales), quality-eval (moteur)
  middleware.ts   Protection des routes
prisma/           schema.prisma · seed.ts
scripts/          erp-sync.ts
```

## Règles métier

- Articles & Magasins proviennent **uniquement de l'ERP**.
- Après **validation production**, les données de production sont
  **verrouillées définitivement**.
- Le Responsable Qualité **ne peut jamais modifier** les données de
  production ; il complète uniquement le contrôle qualité.
- Un rejet qualité crée automatiquement une **fiche de non-conformité**.
- Le Responsable Gestion Production **clôture** l'OF après validation qualité.
- Chaque validation est **horodatée et signée** ; toutes les actions sont
  **historisées** (utilisateur, date, avant/après, IP, navigateur).

## Workflow

`Production → Validation Production → Qualité → Validation Qualité → Clôture OF`
