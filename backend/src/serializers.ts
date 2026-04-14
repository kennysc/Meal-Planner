import { DayOfWeek, MealStatus, MealType, ShoppingSection } from '@prisma/client'

const dayLabels: Record<DayOfWeek, string> = {
  MONDAY: 'Lundi',
  TUESDAY: 'Mardi',
  WEDNESDAY: 'Mercredi',
  THURSDAY: 'Jeudi',
  FRIDAY: 'Vendredi',
  SATURDAY: 'Samedi',
  SUNDAY: 'Dimanche',
}

const mealLabels: Record<MealType, string> = {
  DINNER: 'Diner',
  SUPPER: 'Souper',
}

const statusLabels: Record<MealStatus, string> = {
  PLANNED: 'Planifie',
  MADE: 'Prepare',
  SKIPPED: 'Annule',
}

const sectionLabels: Record<ShoppingSection, string> = {
  PRODUCE: 'Fruits et legumes',
  MEAT: 'Viandes',
  DAIRY: 'Produits laitiers',
  PANTRY: 'Garde-manger',
  OTHER: 'Autre',
}

export function serializeRecipe(recipe: any) {
  return {
    id: recipe.id,
    name: recipe.name,
    url: recipe.url,
    notes: recipe.notes,
    sortOrder: recipe.sortOrder,
    isFavorite: recipe.isFavorite,
    isArchived: recipe.isArchived,
    createdAt: recipe.createdAt,
    updatedAt: recipe.updatedAt,
    tags: recipe.recipeTags?.map((recipeTag: any) => recipeTag.tag) ?? [],
    ingredients:
      recipe.recipeIngredients?.map((recipeIngredient: any) => ({
        id: recipeIngredient.id,
        ingredientId: recipeIngredient.ingredientId,
        name: recipeIngredient.ingredient.name,
        quantityText: recipeIngredient.quantityText,
        isPantryStaple: recipeIngredient.isPantryStaple,
      })) ?? [],
  }
}

export function serializeMealEntry(mealEntry: any) {
  return {
    id: mealEntry.id,
    dayOfWeek: mealEntry.dayOfWeek,
    dayLabel: dayLabels[mealEntry.dayOfWeek as DayOfWeek],
    mealType: mealEntry.mealType,
    mealLabel: mealLabels[mealEntry.mealType as MealType],
    title: mealEntry.title,
    notes: mealEntry.notes,
    status: mealEntry.status,
    statusLabel: statusLabels[mealEntry.status as MealStatus],
    recipeUrl: mealEntry.recipeUrl,
    recipeId: mealEntry.recipeId,
    recipe: mealEntry.recipe ? serializeRecipe(mealEntry.recipe) : null,
  }
}

export function serializeShoppingItem(item: any) {
  return {
    id: item.id,
    label: item.label,
    quantityText: item.quantityText,
    checked: item.checked,
    section: item.section,
    sectionLabel: item.section ? sectionLabels[item.section as ShoppingSection] : null,
    ingredientId: item.ingredientId,
    sourceRecipeId: item.sourceRecipeId,
    sourceMealEntryId: item.sourceMealEntryId,
  }
}
