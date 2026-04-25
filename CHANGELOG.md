# Changelog

Toutes les evolutions importantes de l'application seront suivies ici.

Le projet suit une approche de versionnement semantique simple :

- `MAJOR` pour des changements incompatibles
- `MINOR` pour de nouvelles fonctionnalites compatibles
- `PATCH` pour des corrections et ajustements

## 0.2.0 - 2026-04-25

### Ameliore

- securisation des mises a jour de recettes et de la creation/reparation des semaines
- validations backend, gestion d'erreurs Prisma et requetes recettes plus legeres
- optimisations frontend pour les suggestions, les donnees derivees et les types API/i18n
- workflow de validation avec scripts `typecheck`, CI, exemples d'environnement et Docker reproductible

## 0.1.0 - 2026-04-13

Premiere base fonctionnelle du projet.

### Ajoute

- structure full-stack `frontend + backend + PostgreSQL`
- application React responsive avec interface principale en francais canadien
- base i18n prete pour le francais et l anglais
- grille hebdomadaire `Diner / Souper`
- liste d epicerie liee a la semaine
- gestion initiale des recettes, ingredients et etiquettes
- historique des semaines et copie de la semaine precedente
- suggestions de repas depuis recettes et historique
- ajout d ingredients a l epicerie a partir d une recette
- Dockerfiles et orchestration `docker-compose.yml`
- documentation initiale dans `README.md`
