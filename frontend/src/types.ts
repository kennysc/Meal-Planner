export type Locale = 'fr-CA' | 'en-CA'

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export type MealType = 'DINNER' | 'SUPPER'
export type MealStatus = 'PLANNED' | 'MADE' | 'SKIPPED'

export type Suggestion = {
  id: string
  label: string
  type: 'recipe' | 'history'
  recipeId: string | null
  recipeUrl: string | null
  tags: string[]
}

export type RecipeIngredient = {
  id: string
  ingredientId: string
  name: string
  quantityText: string
  group: string | null
  isPantryStaple: boolean
}

export type Recipe = {
  id: string
  name: string
  url: string | null
  notes: string
  sortOrder: number
  isFavorite: boolean
  isArchived: boolean
  tags: Array<{ id: string; name: string }>
  ingredients: RecipeIngredient[]
  lastMadeAt?: string | null
  usageCount?: number
}

export type Meal = {
  id: string
  dayOfWeek: DayOfWeek
  mealType: MealType
  title: string
  notes: string
  status: MealStatus
  recipeUrl: string | null
  recipeId: string | null
  recipe: Recipe | null
}

export type ShoppingItem = {
  id: string
  label: string
  quantityText: string | null
  checked: boolean
  section: string | null
  sectionLabel: string | null
  ingredientId: string | null
  sourceRecipeId: string | null
  sourceMealEntryId: string | null
}

export type Week = {
  id: string
  startDate: string
  label: string
  meals: Meal[]
  shoppingList: {
    id: string
    items: ShoppingItem[]
  }
}

export type WeekSummary = {
  id: string
  startDate: string
  label: string
  highlights: string[]
}
