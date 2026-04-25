import type { Locale, Meal, MealStatus, Recipe, ShoppingItem, Suggestion, Week, WeekSummary } from './types'

export type UpdateMealPayload = {
  title?: string
  notes?: string
  status?: MealStatus
  recipeId?: string | null
  recipeUrl?: string | null
}

export type UpdateShoppingItemPayload = {
  checked?: boolean
  label?: string
  quantityText?: string | null
  section?: string | null
}

const apiBase = import.meta.env.VITE_API_URL ?? ''

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(payload.message ?? 'Request failed')
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function fetchCurrentWeek(locale: Locale) {
  return request<{ week: Week }>(`/api/weeks/current?locale=${locale}`)
}

export async function fetchWeek(weekId: string, locale: Locale) {
  return request<{ week: Week }>(`/api/weeks/${weekId}?locale=${locale}`)
}

export async function fetchWeeks(locale: Locale) {
  return request<{ weeks: WeekSummary[] }>(`/api/weeks?locale=${locale}`)
}

export async function createWeek(date: string, locale: Locale) {
  return request<{ week: Week }>(`/api/weeks?locale=${locale}`, {
    method: 'POST',
    body: JSON.stringify({ date }),
  })
}

export async function copyPreviousWeek(weekId: string) {
  return request<{ week: { meals: Meal[] } }>(`/api/weeks/${weekId}/copy-previous`, { method: 'POST' })
}

export async function updateMeal(weekId: string, mealId: string, payload: UpdateMealPayload) {
  return request<{ meal: Meal }>(`/api/weeks/${weekId}/meals/${mealId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function fetchSuggestions(query: string) {
  return request<{ suggestions: Suggestion[] }>(`/api/search/meal-suggestions?q=${encodeURIComponent(query)}`)
}

export async function fetchRecipes(params: {
  search?: string
  tags?: string[]
  ingredients?: string[]
  ingredientMode?: 'any' | 'all'
}) {
  const searchParams = new URLSearchParams()
  if (params.search) searchParams.set('search', params.search)
  if (params.tags?.length) searchParams.set('tags', params.tags.join(','))
  if (params.ingredients?.length) searchParams.set('ingredients', params.ingredients.join(','))
  if (params.ingredientMode) searchParams.set('ingredientMode', params.ingredientMode)
  return request<{ recipes: Recipe[] }>(`/api/recipes?${searchParams.toString()}`)
}

export async function createRecipe(payload: {
  name: string
  url?: string
  notes?: string
  isFavorite?: boolean
  tags: string[]
  ingredients: Array<{ name: string; quantityText?: string; group?: string; isPantryStaple?: boolean }>
}) {
  return request<{ recipe: Recipe }>('/api/recipes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateRecipe(recipeId: string, payload: {
  name: string
  url?: string
  notes?: string
  isFavorite?: boolean
  isArchived?: boolean
  tags: string[]
  ingredients: Array<{ name: string; quantityText?: string; group?: string; isPantryStaple?: boolean }>
}) {
  return request<{ recipe: Recipe }>(`/api/recipes/${recipeId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function archiveRecipe(recipeId: string) {
  return request<{ recipe: Recipe }>(`/api/recipes/${recipeId}/archive`, { method: 'POST' })
}

export async function addRecipeIngredients(weekId: string, mealId: string, ingredientIds: string[]) {
  return request<{ items: ShoppingItem[] }>(`/api/weeks/${weekId}/meals/${mealId}/add-recipe-ingredients`, {
    method: 'POST',
    body: JSON.stringify({ ingredientIds }),
  })
}

export async function addShoppingItem(weekId: string, payload: { label: string; quantityText?: string }) {
  return request<{ item: ShoppingItem }>(`/api/weeks/${weekId}/shopping-list/items`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateShoppingItem(itemId: string, payload: UpdateShoppingItemPayload) {
  return request<{ item: ShoppingItem }>(`/api/shopping-list/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deleteShoppingItem(itemId: string) {
  return request<void>(`/api/shopping-list/items/${itemId}`, { method: 'DELETE' })
}
