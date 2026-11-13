# Entraîneur d'échecs personnel — contexte du projet

## Pour qui, pour quoi

Application d'entraînement **personnelle** pour un joueur Chess.com d'environ 1800 en rapide, objectif 2000.
Pseudo Chess.com : `anakinskywalker25`.

L'appli ne cherche pas à rivaliser avec une analyse de moteur poussée : à ce niveau, l'important est de **repérer ses erreurs récurrentes** et de **réviser ses ouvertures et ses gaffes**.

Usage : **navigateur sur ordinateur uniquement**. Pas de version mobile, pas de serveur, pas de compte : tout tourne en local dans le navigateur.

## Langue et conventions

- Interface **en français**, notation **française** à l'affichage (R, D, T, F, C ; pas de lettre pour les pions). chess.js produit du SAN anglais : convertir à l'affichage uniquement, garder le SAN anglais en interne et dans les fichiers.
- Code (variables, fonctions, commits) en anglais.
- Avant de livrer une étape : `npm run build` et `npm test` doivent passer.

## Stack technique

| Besoin | Choix |
|---|---|
| Framework | Vite + React + TypeScript |
| Règles, coups légaux, FEN | `chess.js` |
| Échiquier | `react-chessboard` (licence MIT) |
| Lecture des PGN **avec variantes** | `@mliebelt/pgn-parser` (chess.js ne lit pas les variantes) |
| Moteur | `stockfish` (npm, build WebAssembly **lite single-thread**), lancé dans un **Web Worker**, dialogue UCI |
| Stockage | IndexedDB via `dexie` |
| Tests | `vitest` |

## Style visuel

- Plateau simple **vert et crème**, pièces 2D, glisser-déposer + clic-clic.
- Pièces : jeu **cburnett** de Lichess (licence CC BY-SA 3.0 ; mettre l'attribution dans une page « À propos »). **Ne pas utiliser les graphismes de Chess.com.**
- Surbrillance du dernier coup, flèche pour le meilleur coup, coordonnées sur les bords.
- Navigation clavier dans une partie : ← / → coup par coup, Début / Fin.

## Données de répertoire

```
repertoire/
  blancs/trompowsky.pgn     # 5 chapitres, 16 lignes
  noirs/caro-kann.pgn       # Classique 4...Ff5, 9 lignes
  noirs/ragozine.pgn        # Gambit Dame, Ragozine 4...Fb4, 8 lignes
data/
  positions-types.json      # positions types (étape 5), à compléter
```

Règles de lecture :

- La **couleur jouée** vient du dossier (`blancs/` ou `noirs/`) et du tag `[Orientation]`.
- Un fichier peut contenir **plusieurs parties** (chapitres) : toutes font partie du même répertoire.
- Construire un **arbre indexé par position** (clé = les 4 premiers champs du FEN), pas par ordre des coups : le répertoire contient des **transpositions** (ex. Caro-Kann : 6.Cf3 Cd7 7.h4 h6 8.h5 Fh7 = 6.h4 h6 7.Cf3 Cd7 8.h5 Fh7). Les suites connues d'une position s'appliquent quel que soit l'ordre d'arrivée.
- Pour **mes** coups : un seul coup attendu par position (le répertoire a été nettoyé pour ça). Pour les coups **adverses** : toutes les branches.
- Une ligne peut se terminer sur un coup adverse : c'est normal, la révision s'arrête sur mon dernier coup.
- Conserver les annotations `$1` (!) et `$2` (?) pour les afficher.
- Tout ce qui n'est pas dans l'arbre est **hors répertoire** : on le signale, on ne le comble pas.
- Le Système de Londres n'est **pas** dans l'appli (révisé ailleurs).

## Import des parties Chess.com

API publique, sans authentification :

- `https://api.chess.com/pub/player/anakinskywalker25/games/archives` → liste des archives mensuelles
- chaque URL d'archive → `games[]` avec `pgn`, `time_class`, `white`, `black`, `end_time`…

Règles :

- Requêtes **en série** (pas en parallèle), avec cache : une archive de mois passé ne change plus, ne pas la retélécharger.
- Filtre par défaut : `time_class === "rapid"` (réglable).
- Le PGN contient l'horloge à chaque coup (`{[%clk 0:09:41.3]}`) et l'ouverture (`ECO`, `ECOUrl`) : les extraire et les stocker.
- Vérifier au premier essai que l'API répond bien depuis le navigateur (CORS) ; sinon le signaler avant de contourner.

## Analyse et classification des coups

- Stockfish, **profondeur 16** par défaut (réglable), MultiPV 1. Analyser chaque position une seule fois, **cache par FEN** dans IndexedDB.
- Convertir l'évaluation en **pourcentage de gain** (formule utilisée par Lichess), du point de vue du joueur au trait :
  `win% = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)` ; mat pour soi = 100, mat contre soi = 0.
- Perte d'un coup = win% avant le coup − win% après le coup (même point de vue).
- Catégories, seuils dans **un seul fichier de config** :

| Étiquette | Règle |
|---|---|
| ~~Théorie~~ | *non utilisée (abandonnée, voir feuille de route)* |
| Meilleur | coup de Stockfish, ou perte ≤ 2 % |
| Jouable | perte < 10 % |
| Erreur | perte de 10 à 25 % |
| Gaffe | perte > 25 % |

- Les coups adverses sont classés aussi, mais les stats et puzzles ne portent que sur **mes** coups.
- Précision de la partie : moyenne simple à partir des pertes (formule documentée dans le code, pas besoin de reproduire celle de Chess.com).

## Feuille de route

On construit **une étape à la fois**, et chaque étape doit être utilisable seule.

1. **Plateau et analyse** : échiquier jouable (on peut aussi jouer librement contre soi-même), import Chess.com, liste des parties, vue d'une partie avec barre d'évaluation, liste des coups avec badges de couleur par catégorie, flèche du meilleur coup sur les erreurs et gaffes, résumé (nombre de coups par catégorie, précision).
2. **Statistiques** : analyse en arrière-plan des N dernières parties, stats par ouverture (ouverture indiquée par Chess.com via `ECO`/`ECOUrl` : score, précision, phase où tombent les gaffes), stats sur le temps (gaffes avec moins d'une minute à la pendule, coups critiques joués en moins de 5 s).
   *Abandonné* : étiquette « Théorie » et détection de sortie de répertoire dans les parties. L'emplacement prévu (`src/repertoire/index.ts`) reste en place mais vide. La lecture des PGN en arbre est reportée à l'étape 4.
3. **Puzzles de mes gaffes** *(fait)* : deux types, « Punis la gaffe » (grosse erreur adverse non punie) et « Évite la gaffe » (ma gaffe). Passage rapide à profondeur 10, puis vérification des candidats à profondeur 16 (mes 3 meilleurs coups + le coup joué, dans la même position) : puzzle gardé seulement si l'écart est d'au moins 20 % et que la position n'était pas déjà jouée. Solution de 1 à 3 coups tant que le coup suivant est le seul bon. Coups presque aussi bons acceptés (5 %). Bouton « Ce puzzle est faux ». Filtres type / phase / ouverture, répétition espacée. Réglages dans `src/config/puzzles.ts`.
   L'onglet « Statistiques » de l'étape 2 est retiré du menu (code conservé dans `src/screens/StatsScreen.tsx`) : l'analyse pure n'est pas utile à ce niveau.
4. **Entraîneur d'ouvertures** : je joue mes coups du répertoire, l'appli joue les réponses adverses en parcourant toutes les branches, répétition espacée par ligne, filtre par ouverture.
5. **Positions types** : à partir de `data/positions-types.json` : mode QCM « trouve le plan », puis mode « joue la position » contre Stockfish bridé (`UCI_LimitStrength` / `UCI_Elo`).

## Tests à prévoir dès le départ

- Formule win% et seuils de classification (cas limites, positions de mat).
- *(étape 4)* Lecture des trois PGN du répertoire : nombre de lignes attendu (Trompowsky 16, Caro-Kann 9, Ragozine 8) et un seul coup attendu par position pour ma couleur.
- *(étape 4)* Transposition Caro-Kann ci-dessus : les deux ordres de coups mènent au même nœud.
- Extraction de `%clk` et de l'ouverture depuis un PGN Chess.com réel.
