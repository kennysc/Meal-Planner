# Planificateur de repas

## Version actuelle

- `0.1.0`
- Le suivi des evolutions se fait dans `CHANGELOG.md`

## Apercu

Le Planificateur de repas est une application web responsive concue pour aider a organiser les repas de la semaine, gerer des recettes, conserver l'historique des semaines precedentes et produire une liste d'epicerie associee aux repas planifies.

L'application sera principalement en francais canadien, avec une architecture prevue pour supporter aussi l'anglais et potentiellement d'autres langues plus tard.

## Objectifs

- Planifier les repas de la semaine dans une grille simple
- Conserver les semaines precedentes en historique
- Gerer une bibliotheque de recettes
- Rechercher les recettes par nom, etiquette et ingredient
- Generer et maintenir une liste d'epicerie par semaine
- Permettre l'autocompletion des repas a partir de l'historique et des recettes
- Fournir une interface belle, claire et adaptee au cellulaire comme a l'ordinateur
- Faire fonctionner l'application dans Docker avec exposition sur un port

## Fonctionnement general

L'application sera composee de trois espaces principaux :

- Planificateur
- Recettes
- Historique

Une liste d'epicerie sera visible a cote du planificateur sur ordinateur, et sous le planificateur sur cellulaire.

## Planificateur

Le planificateur affiche une semaine complete sous forme de grille.

### Structure

- Lignes : `Lundi` a `Dimanche`
- Colonnes :
  - `Diner`
  - `Souper`

### Contenu d'une case

Chaque case de repas pourra contenir :

- le nom du repas
- une recette associee
- un lien web vers la recette
- une note
- un statut :
  - `Planifie`
  - `Prepare`
  - `Annule`

### Comportement

- La semaine courante s'affiche par defaut
- Il sera possible de consulter et modifier les semaines precedentes
- Il sera possible de :
  - copier la semaine precedente
  - repeter une semaine
  - reutiliser un repas deja planifie dans le passe

### Autocompletion

Lorsqu'un utilisateur commence a taper dans une case, l'application proposera des suggestions provenant de :

- recettes existantes
- anciens repas des semaines precedentes

Les suggestions seront classees selon une logique utile :

- correspondance exacte
- favoris
- recettes recentes
- recettes frequentes
- ancien historique libre

Les suggestions indiqueront clairement si l'element est :

- une recette sauvegardee
- un ancien repas libre

### Creation de recette

Si un repas saisi ne correspond pas a une recette existante, l'application demandera :

- si l'utilisateur veut creer une nouvelle recette a partir de ce repas

### Ajout a la liste d'epicerie

Si une recette est choisie ou associee a un repas, l'application demandera :

- si les ingredients de cette recette doivent etre ajoutes a la liste d'epicerie de la semaine

## Recettes

L'application aura un espace dedie a la gestion des recettes.

### Une recette pourra contenir

- un nom
- un lien web
- des notes
- une liste d'ingredients
- une quantite pour chaque ingredient
- des etiquettes libres creees par l'utilisateur
- un indicateur `favori`
- un ordre manuel
- un etat `archivee`

### Ingredients

La liste globale des ingredients contiendra seulement les noms des ingredients.

Exemples :

- `Poulet`
- `Tomate`
- `Oignon`

Les quantites ne seront pas stockees globalement. Elles seront stockees seulement dans le contexte d'une recette.

Exemples :

- dans une recette : `2 poitrines de poulet`
- dans une autre recette : `500 g de poulet`

### Etiquettes

Les recettes pourront recevoir des etiquettes libres creees par l'utilisateur.

Exemples :

- `Rapide`
- `Pates`
- `BBQ`
- `Vegetarien`
- `Familial`

Les etiquettes serviront a :

- classer les recettes
- filtrer les resultats
- accelerer la recherche

### Recherche de recettes

Les recettes pourront etre recherchees par :

- nom
- etiquette
- ingredient

Les filtres pourront etre combines.

Exemples :

- recettes avec l'etiquette `Rapide`
- recettes contenant `Poulet`
- recettes avec `Poulet` et l'etiquette `BBQ`

Pour la recherche par ingredients, le mode par defaut sera :

- correspond a au moins un ingredient

Une option permettra aussi :

- doit contenir tous les ingredients selectionnes

### Archivage

Les recettes ne seront pas supprimees definitivement par defaut.
Elles seront archivees afin de conserver l'historique des semaines et des references existantes.

## Liste d'epicerie

Chaque semaine possedera sa propre liste d'epicerie.

### Fonctionnalites

- ajout manuel d'items
- ajout d'ingredients a partir d'une recette
- confirmation avant ajout automatique
- coche pour marquer un item comme achete
- suppression d'un item
- dedoublonnage simple des ingredients identiques

### Comportement de dedoublonnage

Si plusieurs repas ajoutent le meme ingredient, l'application essaiera de ne pas creer de doublons evidents.

La premiere version evitera les calculs complexes d'unites. L'objectif est de garder les items lisibles et simples a gerer.

### Evolution possible

La structure sera preparee pour permettre plus tard un classement par sections :

- Fruits et legumes
- Viandes
- Produits laitiers
- Garde-manger
- Autre

## Historique

L'application conservera les semaines precedentes.

### L'historique permettra

- consulter les anciennes semaines
- modifier les anciennes semaines
- copier des repas vers une nouvelle semaine
- analyser l'utilisation des recettes

### Statistiques utiles

Chaque recette pourra afficher des informations comme :

- derniere fois cuisinee
- nombre total d'utilisations

Ces informations aideront a mieux classer les suggestions et a eviter les repetitions.

## Interface et experience utilisateur

L'interface devra etre soignee et moderne, pas seulement utilitaire.

### Sur ordinateur

- le planificateur apparait a gauche
- la liste d'epicerie apparait a droite

### Sur cellulaire

- les sections s'empilent verticalement
- le planificateur apparait en premier
- la liste d'epicerie suit
- la grille reste lisible avec une presentation compacte et un debordement horizontal au besoin

### Langue

La langue principale sera :

- francais canadien avec vocabulaire quebecois

Exemples de libelles :

- `Planificateur`
- `Recettes`
- `Historique`
- `Liste d'epicerie`
- `Copier la semaine precedente`
- `Ajouter a la liste d'epicerie`
- `Creer une recette`
- `Favori`
- `Archivee`

L'architecture de l'application sera preparee pour supporter :

- anglais
- autres langues plus tard

## Architecture technique prevue

### Frontend

- React
- Vite

### Backend

- Node.js
- Express

### Base de donnees

- PostgreSQL
- Prisma comme ORM

### Conteneurisation

- Docker
- Docker Compose

## Deploiement local

L'application sera lancee en conteneurs Docker.

Une configuration standard est prevue :

- `frontend`
- `backend`
- `db`

Le frontend exposera l'application sur un port accessible depuis le navigateur.

## Principes de conception

- interface simple et rapide a utiliser
- donnees persistantes en base de donnees
- possibilite de reutiliser l'historique
- souplesse pour les repas libres
- structure assez solide pour evoluer
- prise en charge de plusieurs langues des le depart

## Fonctionnalites prevues plus tard

Les points suivants sont deja envisages, mais peuvent etre livres apres la premiere version stable :

- export PDF ou impression d'une semaine
- export/import JSON pour sauvegarde
- ingredients de garde-manger exclus automatiquement
- gestion plus fine des sections d'epicerie
- gestion des restants

## Resume

Le Planificateur de repas sera une application web Dockerisee, bilingue a terme, d'abord en francais canadien, qui permettra :

- de planifier les diners et soupers de chaque jour
- d'enregistrer et rechercher des recettes
- d'associer ingredients, etiquettes et liens aux recettes
- de generer une liste d'epicerie hebdomadaire
- de reutiliser l'historique des semaines precedentes
- de fonctionner autant sur ordinateur que sur cellulaire
