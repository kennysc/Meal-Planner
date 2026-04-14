import type { DayOfWeek, Locale, MealStatus, MealType } from './types'

type Dictionary = Record<string, string>

const dictionaries: Record<Locale, Dictionary> = {
  'fr-CA': {
    appTitle: 'Menu',
    planner: 'Planificateur',
    recipes: 'Recettes',
    history: 'Historique',
    shoppingList: 'Liste d epicerie',
    weekOf: 'Semaine du',
    copyPreviousWeek: 'Copier la semaine precedente',
    loading: 'Chargement...',
    loadFailed: 'Impossible de charger l application.',
    save: 'Enregistrer',
    add: 'Ajouter',
    addItem: 'Ajouter un item',
    addRecipe: 'Ajouter une recette',
    searchRecipes: 'Chercher une recette',
    searchTags: 'Etiquettes',
    searchIngredients: 'Ingredients',
    matchAny: 'Au moins un ingredient',
    matchAll: 'Tous les ingredients',
    notes: 'Notes',
    recipeUrl: 'Lien recette',
    mealName: 'Nom du repas',
    noRecipe: 'Aucune recette',
    favorite: 'Favori',
    ingredients: 'Ingredients',
    tags: 'Etiquettes',
    status: 'Statut',
    openRecipe: 'Ouvrir la recette',
    createRecipePrompt: 'Ce repas n existe pas encore comme recette. Voulez-vous creer une recette de base?',
    ingredientPrompt: 'Choisir les ingredients a ajouter a la liste d epicerie',
    confirmIngredients: 'Ajouter les ingredients selectionnes',
    emptyHistory: 'Aucune autre semaine n est encore disponible.',
    emptyRecipes: 'Aucune recette ne correspond aux filtres actuels.',
    language: 'Langue',
    source: 'Source',
    pantryStaple: 'Garde-manger',
    usageCount: 'Utilisations',
    lastMade: 'Derniere fois',
    quickCreateRecipe: 'Creer une recette rapide',
    close: 'Fermer',
    darkMode: 'Mode sombre',
    lightMode: 'Mode clair',
    edit: 'Modifier',
    open: 'Ouvrir',
    openLinkConfirm: 'Voulez-vous ouvrir ce lien?',
    settings: 'Parametres',
    resetColors: 'Reinitialiser',
    colorBase: 'Couleur de base',
    colorSurface: 'Couleur surface',
    colorMuted: 'Couleur attenuation',
    colorAccent: 'Couleur accent',
  },
  'en-CA': {
    appTitle: 'Menu',
    planner: 'Planner',
    recipes: 'Recipes',
    history: 'History',
    shoppingList: 'Shopping list',
    weekOf: 'Week of',
    copyPreviousWeek: 'Copy previous week',
    loading: 'Loading...',
    loadFailed: 'Unable to load the app.',
    save: 'Save',
    add: 'Add',
    addItem: 'Add item',
    addRecipe: 'Add recipe',
    searchRecipes: 'Search recipes',
    searchTags: 'Tags',
    searchIngredients: 'Ingredients',
    matchAny: 'Match any ingredient',
    matchAll: 'Match all ingredients',
    notes: 'Notes',
    recipeUrl: 'Recipe link',
    mealName: 'Meal name',
    noRecipe: 'No recipe',
    favorite: 'Favorite',
    ingredients: 'Ingredients',
    tags: 'Tags',
    status: 'Status',
    openRecipe: 'Open recipe',
    createRecipePrompt: 'This meal is not a saved recipe yet. Create a quick recipe draft?',
    ingredientPrompt: 'Choose which ingredients to add to the shopping list',
    confirmIngredients: 'Add selected ingredients',
    emptyHistory: 'No previous weeks are available yet.',
    emptyRecipes: 'No recipes match the current filters.',
    language: 'Language',
    source: 'Source',
    pantryStaple: 'Pantry staple',
    usageCount: 'Uses',
    lastMade: 'Last made',
    quickCreateRecipe: 'Quick recipe draft',
    close: 'Close',
    darkMode: 'Dark mode',
    lightMode: 'Light mode',
    edit: 'Edit',
    open: 'Open',
    openLinkConfirm: 'Do you want to open this link?',
    settings: 'Settings',
    resetColors: 'Reset',
    colorBase: 'Base color',
    colorSurface: 'Surface color',
    colorMuted: 'Muted color',
    colorAccent: 'Accent color',
  },
}

export function t(locale: Locale, key: string) {
  return dictionaries[locale][key] ?? key
}

const dayLabels: Record<Locale, Record<DayOfWeek, string>> = {
  'fr-CA': {
    MONDAY: 'Lundi',
    TUESDAY: 'Mardi',
    WEDNESDAY: 'Mercredi',
    THURSDAY: 'Jeudi',
    FRIDAY: 'Vendredi',
    SATURDAY: 'Samedi',
    SUNDAY: 'Dimanche',
  },
  'en-CA': {
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
    SATURDAY: 'Saturday',
    SUNDAY: 'Sunday',
  },
}

const mealLabels: Record<Locale, Record<MealType, string>> = {
  'fr-CA': { DINNER: 'Diner', SUPPER: 'Souper' },
  'en-CA': { DINNER: 'Dinner', SUPPER: 'Supper' },
}

const statusLabels: Record<Locale, Record<MealStatus, string>> = {
  'fr-CA': { PLANNED: 'Planifie', MADE: 'Prepare', SKIPPED: 'Annule' },
  'en-CA': { PLANNED: 'Planned', MADE: 'Made', SKIPPED: 'Skipped' },
}

export function dayLabel(locale: Locale, day: DayOfWeek) {
  return dayLabels[locale][day]
}

export function mealLabel(locale: Locale, meal: MealType) {
  return mealLabels[locale][meal]
}

export function statusLabel(locale: Locale, status: MealStatus) {
  return statusLabels[locale][status]
}
