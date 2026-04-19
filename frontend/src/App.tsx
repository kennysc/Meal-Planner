import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import './App.css'
import {
  addRecipeIngredients,
  addShoppingItem,
  createRecipe,
  createWeek,
  deleteShoppingItem,
  fetchCurrentWeek,
  fetchRecipes,
  fetchSuggestions,
  fetchWeek,
  fetchWeeks,
  updateMeal,
  updateRecipe,
  updateShoppingItem,
} from './api'
import { dayLabel, mealLabel, t } from './i18n'
import type { Locale, Meal, MealType, Recipe, ShoppingItem, Suggestion, Week, WeekSummary } from './types'

type DesktopTab = 'planner' | 'recipes' | 'history'
type MobileTab = 'dinner' | 'supper' | 'shopping' | 'recipes' | 'history'
type ActiveTab = DesktopTab | MobileTab
type Theme = 'light' | 'dark'
type AccentName = (typeof CATPPUCCIN_ACCENTS)[number]
type NavTab<TTab extends ActiveTab> = {
  key: TTab
  label: string
}
type RecipeDraft = {
  name: string
  url: string
  notes: string
  tags: string[]
  ingredients: IngredientDraft[]
  isFavorite: boolean
}

type IngredientDraft = {
  name: string
  quantity: string
  unit: string
  group: string
}

type ActiveEditorField = {
  scope: 'form' | 'modal'
  kind: 'ingredient' | 'group' | 'tag'
  index?: number
} | null

const PANTRY_GROUPS = new Set(['pantry', 'garde-manger', 'garde manger'])

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const
const CATPPUCCIN_ACCENTS = [
  'rosewater',
  'flamingo',
  'pink',
  'mauve',
  'red',
  'maroon',
  'peach',
  'yellow',
  'green',
  'teal',
  'sky',
  'sapphire',
  'blue',
  'lavender',
] as const
const DEFAULT_ACCENT: Record<Theme, AccentName> = { light: 'mauve', dark: 'mauve' }
const EMPTY_RECIPE_DRAFT: RecipeDraft = { name: '', url: '', notes: '', tags: [], ingredients: [], isFavorite: false }

function getStoredAccent(theme: Theme) {
  if (typeof window === 'undefined') return DEFAULT_ACCENT[theme]
  const stored = window.localStorage.getItem(`${theme}-accent`)
  return CATPPUCCIN_ACCENTS.includes(stored as AccentName) ? (stored as AccentName) : DEFAULT_ACCENT[theme]
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function addDraftTag(tags: string[], value: string) {
  const nextTag = value.trim()
  if (!nextTag) return tags
  if (tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())) return tags
  return [...tags, nextTag]
}

function isIngredientDraftEmpty(ingredient: IngredientDraft) {
  return !ingredient.name.trim() && !ingredient.quantity.trim() && !ingredient.unit.trim() && !ingredient.group.trim()
}

function ensureEditableIngredientRows(ingredients: IngredientDraft[]) {
  const filledIngredients = ingredients.filter((ingredient) => !isIngredientDraftEmpty(ingredient))
  return [...filledIngredients, toIngredientDraft()]
}

function toIngredientDraft(ingredient?: Partial<IngredientDraft>): IngredientDraft {
  return {
    name: ingredient?.name ?? '',
    quantity: ingredient?.quantity ?? '',
    unit: ingredient?.unit ?? '',
    group: ingredient?.group ?? '',
  }
}

function normalizeGroup(value: string) {
  return value.trim().toLowerCase()
}

function normalizeIngredientName(value: string) {
  return value.trim().toLowerCase()
}

function isPantryGroup(value: string) {
  return PANTRY_GROUPS.has(normalizeGroup(value))
}

function splitQuantityText(quantityText: string) {
  const trimmed = quantityText.trim()
  if (!trimmed) return { quantity: '', unit: '' }

  const match = trimmed.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞.,/-]+(?:\s+[\d¼½¾⅓⅔⅛⅜⅝⅞.,/-]+)?)\s+(.*)$/)
  if (!match) return { quantity: trimmed, unit: '' }

  return {
    quantity: match[1]?.trim() ?? '',
    unit: match[2]?.trim() ?? '',
  }
}

function joinQuantityUnit(quantity: string, unit: string) {
  return [quantity.trim(), unit.trim()].filter(Boolean).join(' ')
}

function autoResizeTextarea(event: FormEvent<HTMLTextAreaElement>) {
  const element = event.currentTarget
  element.style.height = '0px'
  element.style.height = `${element.scrollHeight}px`
}

function applyKnownIngredientDefaults(ingredient: IngredientDraft, knownIngredient?: { unit: string; group: string }) {
  if (!knownIngredient) return ingredient
  return {
    ...ingredient,
    unit: ingredient.unit.trim() ? ingredient.unit : knownIngredient.unit,
    group: ingredient.group.trim() ? ingredient.group : knownIngredient.group,
  }
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase()
}

function commonIngredientGroups(locale: Locale) {
  return locale === 'fr-CA'
    ? ['Fruits et legumes', 'Viandes', 'Produits laitiers', 'Boulangerie', 'Surgelés', 'Conserves', 'Épices', 'Collations', 'Boissons', 'Garde-manger']
    : ['Produce', 'Meat', 'Dairy', 'Bakery', 'Frozen', 'Canned', 'Spices', 'Snacks', 'Beverages', 'Pantry']
}

function recipeToDraft(recipe: Recipe): RecipeDraft {
  return {
    name: recipe.name,
    url: recipe.url ?? '',
    notes: recipe.notes,
    tags: recipe.tags.map((tag) => tag.name),
    ingredients: recipe.ingredients.map((ingredient) => {
      const { quantity, unit } = splitQuantityText(ingredient.quantityText)
      return toIngredientDraft({
        name: ingredient.name,
        quantity,
        unit,
        group: ingredient.group ?? (ingredient.isPantryStaple ? 'Garde-manger' : ''),
      })
    }),
    isFavorite: recipe.isFavorite,
  }
}

function mealHasContent(meal: Meal) {
  return Boolean(meal.title.trim() || meal.notes.trim() || meal.recipeUrl || meal.recipe)
}

function mealDisplayTitle(meal: Meal) {
  return meal.title.trim()
}

function emptyRecipeDraftWithName(name: string): RecipeDraft {
  return { ...EMPTY_RECIPE_DRAFT, name, ingredients: [toIngredientDraft()] }
}

function parseRecipeDraft(draft: RecipeDraft) {
  return {
    name: draft.name.trim(),
    url: draft.url.trim(),
    notes: draft.notes.trim(),
    isFavorite: draft.isFavorite,
    tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
    ingredients: draft.ingredients
      .map((ingredient) => ({
        name: ingredient.name.trim(),
        quantityText: joinQuantityUnit(ingredient.quantity, ingredient.unit) || undefined,
        group: ingredient.group.trim() || undefined,
        isPantryStaple: isPantryGroup(ingredient.group),
      }))
      .filter((ingredient) => ingredient.name),
  }
}

function sameDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function buildCalendarDays(month: Date) {
  const firstDay = startOfMonth(month)
  const offset = (firstDay.getDay() + 6) % 7
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - offset)
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

function toDateString(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function App() {
  const [locale, setLocale] = useState<Locale>('fr-CA')
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    return window.localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [darkAccent, setDarkAccent] = useState<AccentName>(() => getStoredAccent('dark'))
  const [lightAccent, setLightAccent] = useState<AccentName>(() => getStoredAccent('light'))
  const [accentDraft, setAccentDraft] = useState<AccentName>(DEFAULT_ACCENT.light)

  const [activeTab, setActiveTab] = useState<ActiveTab>('planner')
  const [week, setWeek] = useState<Week | null>(null)
  const [weeks, setWeeks] = useState<WeekSummary[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ingredientDialog, setIngredientDialog] = useState<{ mealId: string; recipe: Recipe } | null>(null)
  const [ingredientConfirmDialog, setIngredientConfirmDialog] = useState<{ mealId: string; recipe: Recipe } | null>(null)
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([])
  const [mealActionMeal, setMealActionMeal] = useState<Meal | null>(null)
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [recipeModalDraft, setRecipeModalDraft] = useState<RecipeDraft>(EMPTY_RECIPE_DRAFT)
  const [recipeModalRecipeId, setRecipeModalRecipeId] = useState<string | null>(null)
  const [recipeModalLocked, setRecipeModalLocked] = useState(false)
  const [recipeModalSuggestions, setRecipeModalSuggestions] = useState<Suggestion[]>([])
  const [recipeModalSaving, setRecipeModalSaving] = useState(false)
  const [recipeModalError, setRecipeModalError] = useState<string | null>(null)
  const [recipeModalTagDraft, setRecipeModalTagDraft] = useState('')
  const [recipeModalTagEditing, setRecipeModalTagEditing] = useState(false)
  const [weekPickerOpen, setWeekPickerOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => new Date())
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [recipeSearch, setRecipeSearch] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [ingredientMode, setIngredientMode] = useState<'any' | 'all'>('any')
  const [shoppingDraft, setShoppingDraft] = useState('')
  const [recipeForm, setRecipeForm] = useState<RecipeDraft>({
    ...EMPTY_RECIPE_DRAFT,
    ingredients: [toIngredientDraft()],
  })
  const [recipeFormTagDraft, setRecipeFormTagDraft] = useState('')
  const [recipeFormTagEditing, setRecipeFormTagEditing] = useState(false)
  const [activeGroupQuery, setActiveGroupQuery] = useState('')
  const [activeIngredientQuery, setActiveIngredientQuery] = useState('')
  const [activeEditorField, setActiveEditorField] = useState<ActiveEditorField>(null)
  const recipeModalSelectedRecipeRef = useRef<Recipe | null>(null)
  const recipeSuggestionRequestRef = useRef(0)
  const editorBlurTimeoutRef = useRef<number | null>(null)
  const mobileTabRefs = useRef<Partial<Record<MobileTab, HTMLButtonElement | null>>>({})

  function setRecipeDebug(message: string) {
    console.log('[recipe-modal]', message)
  }

  function cancelEditorBlur() {
    if (editorBlurTimeoutRef.current === null) return
    window.clearTimeout(editorBlurTimeoutRef.current)
    editorBlurTimeoutRef.current = null
  }

  function scheduleEditorBlur() {
    cancelEditorBlur()
    editorBlurTimeoutRef.current = window.setTimeout(() => {
      setActiveEditorField(null)
      editorBlurTimeoutRef.current = null
    }, 120)
  }

  useEffect(() => {
    void loadDashboard(locale)
  }, [locale])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const accent = theme === 'dark' ? darkAccent : lightAccent
    document.documentElement.style.setProperty('--accent', `var(--ctp-${accent})`)
  }, [theme, darkAccent, lightAccent])

  useEffect(() => {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>('.ingredient-table-textarea')
    textareas.forEach((element) => {
      element.style.height = '0px'
      element.style.height = `${element.scrollHeight}px`
    })
  }, [recipeForm.ingredients, recipeModalDraft.ingredients, recipeModalLocked])

  async function loadDashboard(nextLocale: Locale) {
    setLoading(true)
    setLoadError(null)
    try {
      const [weekResponse, weeksResponse, recipesResponse] = await Promise.all([
        fetchCurrentWeek(nextLocale),
        fetchWeeks(nextLocale),
        fetchRecipes({ ingredientMode: 'any' }),
      ])

      setWeek(weekResponse.week)
      setWeeks(weeksResponse.weeks)
      setRecipes(recipesResponse.recipes)
      setRecipeModalSuggestions([])
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load app')
    } finally {
      setLoading(false)
    }
  }

  async function refreshWeekList() {
    const response = await fetchWeeks(locale)
    setWeeks(response.weeks)
  }

  async function refreshRecipes() {
    const response = await fetchRecipes({
      search: recipeSearch,
      tags: splitList(tagSearch),
      ingredients: splitList(ingredientSearch),
      ingredientMode,
    })
    setRecipes(response.recipes)
  }

  function upsertRecipe(recipe: Recipe) {
    setRecipes((current) => {
      const existingIndex = current.findIndex((item) => item.id === recipe.id)
      if (existingIndex === -1) return [recipe, ...current]
      const next = [...current]
      next[existingIndex] = recipe
      return next
    })
  }

  function setAccentForTheme(nextAccent: AccentName) {
    const prefix = theme === 'dark' ? 'dark' : 'light'
    window.localStorage.setItem(`${prefix}-accent`, nextAccent)
    if (theme === 'dark') setDarkAccent(nextAccent)
    else setLightAccent(nextAccent)
  }

  function openSettings() {
    setAccentDraft(theme === 'dark' ? darkAccent : lightAccent)
    setSettingsOpen(true)
  }

  function closeSettings() {
    setSettingsOpen(false)
    const accent = theme === 'dark' ? darkAccent : lightAccent
    document.documentElement.style.setProperty('--accent', `var(--ctp-${accent})`)
  }

  function applyAccentDraft() {
    setAccentForTheme(accentDraft)
    setSettingsOpen(false)
  }

  function resetAccent() {
    const nextAccent = DEFAULT_ACCENT[theme]
    window.localStorage.removeItem(`${theme}-accent`)
    if (theme === 'dark') setDarkAccent(nextAccent)
    else setLightAccent(nextAccent)
    setAccentDraft(nextAccent)
  }

  function findRecipeByName(name: string, source = recipes) {
    const normalized = name.trim().toLowerCase()
    return source.find((recipe) => recipe.name.trim().toLowerCase() === normalized) ?? null
  }

  async function fetchExactRecipe(name: string) {
    const localMatch = findRecipeByName(name)
    if (localMatch) return localMatch
    const response = await fetchRecipes({ search: name })
    const exactMatch = findRecipeByName(name, response.recipes)
    if (exactMatch) upsertRecipe(exactMatch)
    return exactMatch
  }

  function applyExistingRecipe(recipe: Recipe) {
    recipeSuggestionRequestRef.current += 1
    recipeModalSelectedRecipeRef.current = recipe
    setRecipeModalDraft(recipeToDraft(recipe))
    setRecipeModalRecipeId(recipe.id)
    setRecipeModalLocked(true)
    setRecipeModalSuggestions([])
    setRecipeModalError(null)
    setRecipeDebug(`selected existing recipe ${recipe.id} (${recipe.name})`)
  }

  async function handleRecipeNameInput(value: string) {
    const selectedRecipe = recipeModalRecipeId ? recipes.find((recipe) => recipe.id === recipeModalRecipeId) ?? null : null
    const isSwitchingRecipes = selectedRecipe ? selectedRecipe.name.trim().toLowerCase() !== value.trim().toLowerCase() : false

    if (isSwitchingRecipes) {
      recipeModalSelectedRecipeRef.current = null
      setRecipeModalError(null)
      setRecipeDebug(`switching to new recipe search: ${value.trim() || '(empty)'}`)
      setRecipeModalDraft(emptyRecipeDraftWithName(value))
      setRecipeModalRecipeId(null)
      setRecipeModalLocked(false)
    } else {
      setRecipeModalDraft((current) => ({ ...current, name: value }))
    }

    const trimmedValue = value.trim()
    if (trimmedValue.length < 2) {
      recipeSuggestionRequestRef.current += 1
      setRecipeModalSuggestions([])
      return
    }

    const requestId = recipeSuggestionRequestRef.current + 1
    recipeSuggestionRequestRef.current = requestId
    const response = await fetchSuggestions(trimmedValue)
    if (recipeSuggestionRequestRef.current !== requestId) return
    setRecipeModalSuggestions(response.suggestions)

    const exactMatch = findRecipeByName(trimmedValue)
    if (exactMatch) {
      applyExistingRecipe(exactMatch)
    } else if (isSwitchingRecipes) {
      setRecipeModalDraft(emptyRecipeDraftWithName(value))
    }
  }

  async function applyRecipeSuggestion(suggestion: Suggestion) {
    recipeSuggestionRequestRef.current += 1
    setRecipeModalError(null)
    setRecipeDebug(`clicked suggestion ${suggestion.label} type=${suggestion.type} recipeId=${suggestion.recipeId ?? 'null'}`)
    if (suggestion.recipeId) {
      setRecipeModalDraft(emptyRecipeDraftWithName(suggestion.label))
      setRecipeModalRecipeId(suggestion.recipeId)
      setRecipeModalLocked(true)
      setRecipeModalSuggestions([])

      const matchedRecipe = recipes.find((recipe) => recipe.id === suggestion.recipeId) ?? await fetchExactRecipe(suggestion.label)
      if (matchedRecipe) {
        applyExistingRecipe(matchedRecipe)
        return
      }

      setRecipeDebug(`suggestion resolve failed for ${suggestion.label}`)

    }

    setRecipeModalDraft((current) => ({ ...current, name: suggestion.label, url: suggestion.recipeUrl ?? current.url }))
    recipeModalSelectedRecipeRef.current = null
    setRecipeModalRecipeId(null)
    setRecipeModalLocked(false)
    setRecipeModalSuggestions([])
    setRecipeDebug(`freeform suggestion applied ${suggestion.label}`)
  }

  function openMealEditor(mealId: string) {
    const meal = week?.meals.find((item) => item.id === mealId)
    if (!meal) return

    setEditingMealId(mealId)
    recipeSuggestionRequestRef.current += 1
    setRecipeModalSuggestions([])
    setRecipeModalError(null)
    setRecipeModalTagDraft('')
    setRecipeModalTagEditing(false)
    setActiveGroupQuery('')
    setActiveIngredientQuery('')
    setActiveEditorField(null)
    setRecipeDebug(`opened meal editor ${mealId}`)

    if (meal.recipe) {
      recipeModalSelectedRecipeRef.current = meal.recipe
      setRecipeModalDraft(recipeToDraft(meal.recipe))
      setRecipeModalRecipeId(meal.recipe.id)
      setRecipeModalLocked(true)
      return
    }

    recipeModalSelectedRecipeRef.current = null
    setRecipeModalDraft({
      name: meal.title,
      url: meal.recipeUrl ?? '',
      notes: meal.notes,
      tags: [],
      ingredients: [toIngredientDraft()],
      isFavorite: false,
    })
    setRecipeModalRecipeId(null)
    setRecipeModalLocked(false)
  }

  function handleMealTileClick(meal: Meal) {
    if (!mealHasContent(meal)) {
      openMealEditor(meal.id)
      return
    }

    setMealActionMeal(meal)
  }

  function handleMealActionEdit() {
    if (!mealActionMeal) return
    const mealId = mealActionMeal.id
    setMealActionMeal(null)
    openMealEditor(mealId)
  }

  function closeMealEditor() {
    setRecipeDebug('closing meal editor')
    recipeSuggestionRequestRef.current += 1
    recipeModalSelectedRecipeRef.current = null
    setEditingMealId(null)
    setRecipeModalRecipeId(null)
    setRecipeModalDraft(EMPTY_RECIPE_DRAFT)
    setRecipeModalLocked(false)
    setRecipeModalSuggestions([])
    setRecipeModalSaving(false)
    setRecipeModalError(null)
    setRecipeModalTagDraft('')
    setRecipeModalTagEditing(false)
    setActiveGroupQuery('')
    setActiveIngredientQuery('')
    setActiveEditorField(null)
  }

  function commitRecipeFormTag() {
    setRecipeForm((current) => ({ ...current, tags: addDraftTag(current.tags, recipeFormTagDraft) }))
    setRecipeFormTagDraft('')
    setRecipeFormTagEditing(false)
    setActiveEditorField(null)
  }

  function removeRecipeFormTag(tagToRemove: string) {
    setRecipeForm((current) => ({ ...current, tags: current.tags.filter((tag) => tag !== tagToRemove) }))
  }

  function commitRecipeModalTag() {
    setRecipeModalDraft((current) => ({ ...current, tags: addDraftTag(current.tags, recipeModalTagDraft) }))
    setRecipeModalTagDraft('')
    setRecipeModalTagEditing(false)
    setActiveEditorField(null)
  }

  function removeRecipeModalTag(tagToRemove: string) {
    setRecipeModalDraft((current) => ({ ...current, tags: current.tags.filter((tag) => tag !== tagToRemove) }))
  }

  function handleRecipeFormTagBlur() {
    if (recipeFormTagDraft.trim()) commitRecipeFormTag()
    else {
      setRecipeFormTagEditing(false)
      setActiveEditorField(null)
    }
  }

  function handleRecipeModalTagBlur() {
    if (recipeModalTagDraft.trim()) commitRecipeModalTag()
    else {
      setRecipeModalTagEditing(false)
      setActiveEditorField(null)
    }
  }

  function beginRecipeFormTagEdit() {
    setRecipeFormTagEditing(true)
    setRecipeFormTagDraft('')
    setActiveEditorField({ scope: 'form', kind: 'tag' })
  }

  function beginRecipeModalTagEdit() {
    setRecipeModalTagEditing(true)
    setRecipeModalTagDraft('')
    setActiveEditorField({ scope: 'modal', kind: 'tag' })
  }

  function updateRecipeFormIngredient(index: number, field: keyof IngredientDraft, value: string) {
    setRecipeForm((current) => ({
      ...current,
      ingredients: ensureEditableIngredientRows(current.ingredients.map((ingredient, ingredientIndex) => (
        ingredientIndex === index
          ? (() => {
              const nextIngredient = { ...ingredient, [field]: value }
              if (field !== 'name') return nextIngredient
              return applyKnownIngredientDefaults(nextIngredient, knownIngredients.find((item) => normalizeIngredientName(item.name) === normalizeIngredientName(value)))
            })()
          : ingredient
      ))),
    }))
  }

  function removeRecipeFormIngredient(index: number) {
    setRecipeForm((current) => ({
      ...current,
      ingredients: ensureEditableIngredientRows(current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index)),
    }))
  }

  function updateRecipeModalIngredient(index: number, field: keyof IngredientDraft, value: string) {
    setRecipeModalDraft((current) => ({
      ...current,
      ingredients: ensureEditableIngredientRows(current.ingredients.map((ingredient, ingredientIndex) => (
        ingredientIndex === index
          ? (() => {
              const nextIngredient = { ...ingredient, [field]: value }
              if (field !== 'name') return nextIngredient
              return applyKnownIngredientDefaults(nextIngredient, knownIngredients.find((item) => normalizeIngredientName(item.name) === normalizeIngredientName(value)))
            })()
          : ingredient
      ))),
    }))
  }

  function applyIngredientSuggestion(scope: 'form' | 'modal', index: number, name: string) {
    setActiveIngredientQuery(name)
    if (scope === 'form') updateRecipeFormIngredient(index, 'name', name)
    else updateRecipeModalIngredient(index, 'name', name)
  }

  function applyGroupSuggestion(scope: 'form' | 'modal', index: number, group: string) {
    setActiveGroupQuery(group)
    if (scope === 'form') updateRecipeFormIngredient(index, 'group', group)
    else updateRecipeModalIngredient(index, 'group', group)
  }

  function applyTagSuggestion(scope: 'form' | 'modal', tag: string) {
    if (scope === 'form') {
      setRecipeFormTagDraft(tag)
      setRecipeForm((current) => ({ ...current, tags: addDraftTag(current.tags, tag) }))
      setRecipeFormTagDraft('')
      setRecipeFormTagEditing(false)
    } else {
      setRecipeModalTagDraft(tag)
      setRecipeModalDraft((current) => ({ ...current, tags: addDraftTag(current.tags, tag) }))
      setRecipeModalTagDraft('')
      setRecipeModalTagEditing(false)
    }
    setActiveEditorField(null)
  }

  function removeRecipeModalIngredient(index: number) {
    setRecipeModalDraft((current) => ({
      ...current,
      ingredients: ensureEditableIngredientRows(current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index)),
    }))
  }

  async function handleRecipeNameBlur() {
    if (recipeModalRecipeId || !recipeModalDraft.name.trim()) return
    const match = await fetchExactRecipe(recipeModalDraft.name)
    if (match) applyExistingRecipe(match)
  }

  async function handleMealRecipeSave() {
    if (!week || !editingMealId || recipeModalSaving) return
    const editingMeal = week.meals.find((meal) => meal.id === editingMealId)
    if (!editingMeal) return

    const payload = parseRecipeDraft(recipeModalDraft)
    if (!payload.name) {
      setRecipeModalError(t(locale, 'mealName'))
      return
    }

    setRecipeModalSaving(true)
    setRecipeModalError(null)
    setRecipeDebug(`save clicked meal=${editingMeal.id} selected=${recipeModalRecipeId ?? 'none'} locked=${String(recipeModalLocked)} payload=${payload.name}`)

    try {
      if (recipeModalLocked && recipeModalRecipeId) {
        setRecipeDebug(`locked path updateMeal start recipe=${recipeModalRecipeId}`)
        const mealResponse = await updateMeal(week.id, editingMeal.id, {
          title: payload.name,
          notes: payload.notes,
          status: editingMeal.status,
          recipeId: recipeModalRecipeId,
          recipeUrl: payload.url || null,
        })
        setRecipeDebug(`locked path updateMeal success recipe=${mealResponse.meal.recipeId ?? 'null'} ingredients=${mealResponse.meal.recipe?.ingredients.length ?? 0}`)

        setWeek((current) =>
          current
            ? {
                ...current,
                meals: current.meals.map((meal) => (meal.id === editingMeal.id ? mealResponse.meal : meal)),
              }
            : current,
        )

        closeMealEditor()

        if (mealResponse.meal.recipe?.ingredients.length) {
          setRecipeDebug('locked path opening ingredient confirm')
          setSelectedIngredientIds(
            mealResponse.meal.recipe.ingredients
              .filter((ingredient) => !ingredient.isPantryStaple)
              .map((ingredient) => ingredient.ingredientId),
          )
          setIngredientConfirmDialog({ mealId: mealResponse.meal.id, recipe: mealResponse.meal.recipe })
        }

        return
      }

      let savedRecipe: Recipe
      if (recipeModalRecipeId) {
        setRecipeDebug(`editing existing recipe ${recipeModalRecipeId}`)
        const response = await updateRecipe(recipeModalRecipeId, payload)
        savedRecipe = response.recipe
        upsertRecipe(savedRecipe)
        recipeModalSelectedRecipeRef.current = savedRecipe
      } else {
        const exactMatch = await fetchExactRecipe(payload.name)
        if (exactMatch) {
          setRecipeDebug(`resolved exact match ${exactMatch.id}`)
          savedRecipe = exactMatch
          recipeModalSelectedRecipeRef.current = exactMatch
        } else {
          setRecipeDebug(`creating recipe ${payload.name}`)
          const response = await createRecipe(payload)
          savedRecipe = response.recipe
          upsertRecipe(savedRecipe)
          recipeModalSelectedRecipeRef.current = savedRecipe
        }
      }

      const mealResponse = await updateMeal(week.id, editingMeal.id, {
        title: savedRecipe.name,
        notes: savedRecipe.notes,
        status: editingMeal.status,
        recipeId: savedRecipe.id,
        recipeUrl: savedRecipe.url,
      })
      setRecipeDebug(`standard path updateMeal success recipe=${mealResponse.meal.recipeId ?? 'null'} ingredients=${mealResponse.meal.recipe?.ingredients.length ?? 0}`)

      setWeek((current) =>
        current
          ? {
              ...current,
              meals: current.meals.map((meal) => (meal.id === editingMeal.id ? mealResponse.meal : meal)),
            }
          : current,
      )

      closeMealEditor()

      if (mealResponse.meal.recipe?.ingredients.length) {
        setRecipeDebug('standard path opening ingredient confirm')
        setSelectedIngredientIds(
          mealResponse.meal.recipe.ingredients
            .filter((ingredient) => !ingredient.isPantryStaple)
            .map((ingredient) => ingredient.ingredientId),
        )
        setIngredientConfirmDialog({ mealId: mealResponse.meal.id, recipe: mealResponse.meal.recipe })
      }
    } catch (error) {
      console.error('[recipe-modal] save failed', error)
      setRecipeModalError(error instanceof Error ? error.message : 'Failed to save recipe')
      setRecipeDebug(`save failed ${error instanceof Error ? error.message : 'unknown error'}`)
    } finally {
      setRecipeModalSaving(false)
    }
  }

  function handleOpenIngredientPicker() {
    if (!ingredientConfirmDialog) return
    setIngredientDialog(ingredientConfirmDialog)
    setIngredientConfirmDialog(null)
  }

  async function handleConfirmIngredients() {
    if (!week || !ingredientDialog) return
    const response = await addRecipeIngredients(week.id, ingredientDialog.mealId, selectedIngredientIds)
    setWeek((current) =>
      current
        ? {
            ...current,
            shoppingList: {
              ...current.shoppingList,
              items: response.items,
            },
          }
        : current,
    )
    setIngredientDialog(null)
    setSelectedIngredientIds([])
  }

  async function handleAddShoppingItem() {
    if (!week || !shoppingDraft.trim()) return
    const response = await addShoppingItem(week.id, { label: shoppingDraft.trim() })
    setWeek((current) =>
      current
        ? {
            ...current,
            shoppingList: {
              ...current.shoppingList,
              items: [...current.shoppingList.items, response.item],
            },
          }
        : current,
    )
    setShoppingDraft('')
  }

  async function toggleShoppingItem(item: ShoppingItem) {
    const response = await updateShoppingItem(item.id, { checked: !item.checked })
    setWeek((current) =>
      current
        ? {
            ...current,
            shoppingList: {
              ...current.shoppingList,
              items: current.shoppingList.items.map((existing) => (existing.id === item.id ? response.item : existing)),
            },
          }
        : current,
    )
  }

  async function removeShoppingItem(itemId: string) {
    await deleteShoppingItem(itemId)
    setWeek((current) =>
      current
        ? {
            ...current,
            shoppingList: {
              ...current.shoppingList,
              items: current.shoppingList.items.filter((item) => item.id !== itemId),
            },
          }
        : current,
    )
  }

  async function handleCreateRecipe() {
    const payload = parseRecipeDraft(recipeForm)
    if (!payload.name) return
    const created = await createRecipe(payload)

    setRecipeForm(EMPTY_RECIPE_DRAFT)
    upsertRecipe(created.recipe)
    setActiveTab('recipes')
  }

  async function handleWeekSelect(weekId: string) {
    const response = await fetchWeek(weekId, locale)
    setWeek(response.week)
    setActiveTab('planner')
  }

  function openWeekPicker() {
    const today = new Date()
    setSelectedCalendarDate(today)
    setCalendarMonth(startOfMonth(today))
    setWeekPickerOpen(true)
  }

  async function handleCreateWeek() {
    const response = await createWeek(toDateString(selectedCalendarDate), locale)
    setWeek(response.week)
    setWeekPickerOpen(false)
    setActiveTab('planner')
    await refreshWeekList()
  }

  const groupedMeals = (week?.meals ?? []).reduce<Record<string, Meal[]>>((accumulator, meal) => {
    accumulator[meal.dayOfWeek] = [...(accumulator[meal.dayOfWeek] ?? []), meal]
    return accumulator
  }, {})

  const mealByDayAndType = (week?.meals ?? []).reduce<Record<string, Meal>>((accumulator, meal) => {
    accumulator[`${meal.dayOfWeek}:${meal.mealType}`] = meal
    return accumulator
  }, {})

  const editingMeal = week?.meals.find((meal) => meal.id === editingMealId) ?? null
  const mobilePlannerTabs: MobileTab[] = ['dinner', 'supper', 'shopping', 'recipes', 'history']
  const desktopTabs: NavTab<DesktopTab>[] = [
    { key: 'planner', label: t(locale, 'planner') },
    { key: 'recipes', label: t(locale, 'recipes') },
    { key: 'history', label: t(locale, 'history') },
  ]
  const mobileTabs: NavTab<MobileTab>[] = [
    { key: 'dinner', label: mealLabel(locale, 'DINNER') },
    { key: 'supper', label: mealLabel(locale, 'SUPPER') },
    { key: 'shopping', label: t(locale, 'shoppingList') },
    { key: 'recipes', label: t(locale, 'recipes') },
    { key: 'history', label: t(locale, 'history') },
  ]
  const currentMobileTab = activeTab === 'planner' ? 'dinner' : (mobilePlannerTabs.includes(activeTab as MobileTab) ? activeTab as MobileTab : 'dinner')

  useEffect(() => {
    mobileTabRefs.current[currentMobileTab]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [currentMobileTab])

  const today = new Date()
  const calendarDays = buildCalendarDays(calendarMonth)
  const ingredientGroupSuggestions = Array.from(new Set([
    ...commonIngredientGroups(locale),
    ...recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.group ?? '')).filter(Boolean),
    ...recipeForm.ingredients.map((ingredient) => ingredient.group.trim()).filter(Boolean),
    ...recipeModalDraft.ingredients.map((ingredient) => ingredient.group.trim()).filter(Boolean),
  ])).sort((left, right) => left.localeCompare(right, locale))
  const filteredIngredientGroupSuggestions = ingredientGroupSuggestions
    .filter((group) => !activeGroupQuery.trim() || normalizeGroup(group).includes(normalizeGroup(activeGroupQuery)))
    .slice(0, 8)
  const knownIngredients = Array.from(new Map(
    recipes.flatMap((recipe) => recipe.ingredients).map((ingredient) => {
      const { unit } = splitQuantityText(ingredient.quantityText)
      const group = ingredient.group ?? (ingredient.isPantryStaple ? 'Garde-manger' : '')
      return [normalizeIngredientName(ingredient.name), { name: ingredient.name, unit, group }]
    }),
  ).values()).sort((left, right) => left.name.localeCompare(right.name, locale))
  const filteredIngredientSuggestions = knownIngredients
    .filter((ingredient) => !activeIngredientQuery.trim() || normalizeIngredientName(ingredient.name).includes(normalizeIngredientName(activeIngredientQuery)))
    .slice(0, 8)
  const knownTags = Array.from(new Set(recipes.flatMap((recipe) => recipe.tags.map((tag) => tag.name.trim())).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, locale))
  const filteredRecipeFormTagSuggestions = knownTags
    .filter((tag) => !recipeFormTagDraft.trim() || normalizeTag(tag).includes(normalizeTag(recipeFormTagDraft)))
    .filter((tag) => !recipeForm.tags.some((existingTag) => normalizeTag(existingTag) === normalizeTag(tag)))
    .slice(0, 8)
  const filteredRecipeModalTagSuggestions = knownTags
    .filter((tag) => !recipeModalTagDraft.trim() || normalizeTag(tag).includes(normalizeTag(recipeModalTagDraft)))
    .filter((tag) => !recipeModalDraft.tags.some((existingTag) => normalizeTag(existingTag) === normalizeTag(tag)))
    .slice(0, 8)
  const recipeFormEditableIngredients = ensureEditableIngredientRows(recipeForm.ingredients)
  const recipeModalEditableIngredients = recipeModalLocked ? recipeModalDraft.ingredients : ensureEditableIngredientRows(recipeModalDraft.ingredients)

  function renderFieldSuggestions(field: Exclude<ActiveEditorField, null>) {
    if (field.kind === 'ingredient') {
      return filteredIngredientSuggestions.length > 0 ? (
        <div className="field-suggestion-list" onMouseDown={cancelEditorBlur}>
          {filteredIngredientSuggestions.map((ingredient) => (
            <button
              key={ingredient.name}
              className="suggestion-item"
              onMouseDown={(event) => {
                event.preventDefault()
                applyIngredientSuggestion(field.scope, field.index ?? 0, ingredient.name)
                setActiveEditorField(null)
              }}
            >
              <strong>{ingredient.name}</strong>
              <span>{[ingredient.unit, ingredient.group].filter(Boolean).join(' · ') || t(locale, 'ingredient')}</span>
            </button>
          ))}
        </div>
      ) : null
    }

    if (field.kind === 'group') {
      return filteredIngredientGroupSuggestions.length > 0 ? (
        <div className="field-suggestion-list" onMouseDown={cancelEditorBlur}>
          {filteredIngredientGroupSuggestions.map((group) => (
            <button
              key={group}
              className="suggestion-item"
              onMouseDown={(event) => {
                event.preventDefault()
                applyGroupSuggestion(field.scope, field.index ?? 0, group)
                setActiveEditorField(null)
              }}
            >
              <strong>{group}</strong>
            </button>
          ))}
        </div>
      ) : null
    }

    const suggestions = field.scope === 'form' ? filteredRecipeFormTagSuggestions : filteredRecipeModalTagSuggestions
    return suggestions.length > 0 ? (
      <div className="field-suggestion-list" onMouseDown={cancelEditorBlur}>
        {suggestions.map((tag) => (
          <button
            key={tag}
            className="suggestion-item"
            onMouseDown={(event) => {
              event.preventDefault()
              applyTagSuggestion(field.scope, tag)
            }}
          >
            <strong>{tag}</strong>
          </button>
        ))}
      </div>
    ) : null
  }

  function renderMealCard(meal: Meal) {
    const title = mealDisplayTitle(meal)

    return (
      <div
        key={meal.id}
        className="meal-card meal-card-clickable"
        onClick={() => handleMealTileClick(meal)}
      >
        <div className="meal-summary">
          {title ? <strong>{title}</strong> : null}
        </div>
      </div>
    )
  }

  function renderMobileMealColumn(mealType: MealType) {
    return (
      <div className="mobile-planner">
        {DAYS.map((day) => {
          const meal = mealByDayAndType[`${day}:${mealType}`]
          return (
            <div key={day} className="mobile-planner-row">
              <div className="planner-day">{dayLabel(locale, day)}</div>
              {meal ? renderMealCard(meal) : <div className="meal-card meal-card-empty" />}
            </div>
          )
        })}
      </div>
    )
  }

  function renderPlannerHeader(title: string) {
    return (
      <div className="panel-header planner-header-row">
        <h2>{title}</h2>
        <button className="primary-button" onClick={openWeekPicker}>{t(locale, 'newWeek')}</button>
      </div>
    )
  }

  function handleShoppingDragStart(index: number) {
    dragIndex.current = index
  }

  function handleShoppingDragOver(event: React.DragEvent, index: number) {
    event.preventDefault()
    setDragOverIndex(index)
    const from = dragIndex.current
    if (from === null || from === index) return
    setWeek((current) => {
      if (!current) return current
      const items = [...current.shoppingList.items]
      const [moved] = items.splice(from, 1)
      items.splice(index, 0, moved)
      dragIndex.current = index
      return { ...current, shoppingList: { ...current.shoppingList, items } }
    })
  }

  function handleShoppingDragEnd() {
    dragIndex.current = null
    setDragOverIndex(null)
  }

  function renderShoppingContent(currentWeek: Week) {
    return (
      <>
        <div className="shopping-entry-row">
          <input
            value={shoppingDraft}
            placeholder={t(locale, 'addItem')}
            onChange={(event) => setShoppingDraft(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void handleAddShoppingItem() }}
          />
          <button
            className="primary-button icon-button"
            onClick={() => void handleAddShoppingItem()}
            aria-label={t(locale, 'add')}
            title={t(locale, 'add')}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
        {currentWeek.shoppingList.items.length > 0 ? (
          <div className="shopping-list">
            {currentWeek.shoppingList.items.map((item, index) => (
              <label
                key={item.id}
                className={['shopping-item', item.checked ? 'checked' : '', dragOverIndex === index ? 'drag-over' : ''].filter(Boolean).join(' ')}
                draggable
                onDragStart={() => handleShoppingDragStart(index)}
                onDragOver={(event) => handleShoppingDragOver(event, index)}
                onDragEnd={handleShoppingDragEnd}
              >
                <input type="checkbox" checked={item.checked} onChange={() => void toggleShoppingItem(item)} />
                <span className="shopping-copy">
                  <strong>{item.label}</strong>
                  {item.quantityText ? <small>{item.quantityText}</small> : null}
                </span>
                <button className="ghost-button" onClick={() => void removeShoppingItem(item.id)}>
                  ×
                </button>
              </label>
            ))}
          </div>
        ) : null}
      </>
    )
  }

  return (
    <div className="app-shell">
      <header className="hero-card">
        <h1 className="hero-title">{t(locale, 'appTitle')}</h1>
        {week?.label ? <span className="week-pill">{week.label}</span> : null}
        <div className="hero-controls">
          <button
            className="header-pill-button"
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            aria-label={theme === 'light' ? t(locale, 'darkMode') : t(locale, 'lightMode')}
            title={theme === 'light' ? t(locale, 'darkMode') : t(locale, 'lightMode')}
          >
            {theme === 'light' ? '◐' : '○'}
          </button>
          <button
            className="header-pill-button"
            onClick={() => setLocale((current) => (current === 'fr-CA' ? 'en-CA' : 'fr-CA'))}
            aria-label={t(locale, 'language')}
          >
            {locale === 'fr-CA' ? 'FR' : 'EN'}
          </button>
          <button className="header-pill-button" onClick={openSettings} aria-label={t(locale, 'settings')} title={t(locale, 'settings')}>
            ⚙
          </button>
        </div>
      </header>

      <section className="panel tab-panel">
        <nav className="tab-bar tab-bar-desktop" aria-label={t(locale, 'planner')}>
          {desktopTabs.map((tab) => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? 'tab-button active' : 'tab-button'}
              onClick={() => setActiveTab(tab.key)}
              aria-current={activeTab === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <nav className="tab-bar tab-bar-mobile" aria-label={t(locale, 'planner')}>
          {mobileTabs.map((tab) => (
            <button
              key={tab.key}
              ref={(element) => {
                mobileTabRefs.current[tab.key] = element
              }}
              className={currentMobileTab === tab.key ? 'tab-button active' : 'tab-button'}
              onClick={() => setActiveTab(tab.key)}
              aria-current={currentMobileTab === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </section>

      {loading ? (
        <section className="panel">
          <p>{t(locale, 'loading')}</p>
        </section>
      ) : loadError ? (
        <section className="panel">
          <p>{loadError}</p>
        </section>
      ) : !week ? (
        <section className="panel">
          <p>{t(locale, 'loadFailed')}</p>
        </section>
      ) : (
        <main className="main-layout">
          <section className={activeTab === 'planner' ? 'content-column desktop-only' : 'content-column desktop-only hidden'}>
            <article className="panel planner-panel">
              {renderPlannerHeader(t(locale, 'planner'))}

              <div className="planner-grid">
                <div className="planner-head planner-corner"></div>
                {(['DINNER', 'SUPPER'] as const).map((mealType) => (
                  <div key={mealType} className="planner-head">
                    {mealLabel(locale, mealType)}
                  </div>
                ))}

                {DAYS.map((day) => (
                  <Fragment key={day}>
                    <div className="planner-day">{dayLabel(locale, day)}</div>
                    {(groupedMeals[day] ?? []).sort((left, right) => left.mealType.localeCompare(right.mealType)).map((meal) => renderMealCard(meal))}
                  </Fragment>
                ))}
              </div>
            </article>
          </section>

          <section className={currentMobileTab === 'dinner' ? 'content-column mobile-only' : 'content-column mobile-only hidden'}>
            <article className="panel planner-panel">
              {renderPlannerHeader(mealLabel(locale, 'DINNER'))}
              {renderMobileMealColumn('DINNER')}
            </article>
          </section>

          <section className={currentMobileTab === 'supper' ? 'content-column mobile-only' : 'content-column mobile-only hidden'}>
            <article className="panel planner-panel">
              {renderPlannerHeader(mealLabel(locale, 'SUPPER'))}
              {renderMobileMealColumn('SUPPER')}
            </article>
          </section>

          <section className={currentMobileTab === 'shopping' ? 'content-column mobile-only' : 'content-column mobile-only hidden'}>
            <article className="panel shopping-panel">
              <div className="panel-header">
                <h2>{t(locale, 'shoppingList')}</h2>
              </div>
              {renderShoppingContent(week)}
            </article>
          </section>

          <section className={activeTab === 'recipes' || currentMobileTab === 'recipes' ? 'content-column' : 'content-column hidden'}>
            <article className="panel">
              <div className="panel-header">
                <h2>{t(locale, 'recipes')}</h2>
              </div>

              <div className="recipe-toolbar">
                <input value={recipeSearch} placeholder={t(locale, 'searchRecipes')} onChange={(event) => setRecipeSearch(event.target.value)} />
                <input value={tagSearch} placeholder={t(locale, 'searchTags')} onChange={(event) => setTagSearch(event.target.value)} />
                <input value={ingredientSearch} placeholder={t(locale, 'searchIngredients')} onChange={(event) => setIngredientSearch(event.target.value)} />
                <select value={ingredientMode} onChange={(event) => setIngredientMode(event.target.value as 'any' | 'all')}>
                  <option value="any">{t(locale, 'matchAny')}</option>
                  <option value="all">{t(locale, 'matchAll')}</option>
                </select>
                <button className="primary-button" onClick={() => void refreshRecipes()}>{t(locale, 'searchRecipes')}</button>
              </div>

              <div className="recipe-layout">
                <div className="recipe-form">
                  <h3>{t(locale, 'addRecipe')}</h3>
                  <input value={recipeForm.name} placeholder={t(locale, 'mealName')} onChange={(event) => setRecipeForm((current) => ({ ...current, name: event.target.value }))} />
                  <input value={recipeForm.url} placeholder={t(locale, 'recipeUrl')} onChange={(event) => setRecipeForm((current) => ({ ...current, url: event.target.value }))} />
                  <textarea value={recipeForm.notes} rows={3} placeholder={t(locale, 'notes')} onChange={(event) => setRecipeForm((current) => ({ ...current, notes: event.target.value }))} />
                  <div className="tag-editor tag-row-field">
                    <div className="chip-row">
                      {recipeForm.tags.map((tag) => (
                        <button key={tag} className="tag-pill" onClick={() => removeRecipeFormTag(tag)}>
                          <span>{tag}</span>
                          <span aria-hidden="true">×</span>
                        </button>
                      ))}
                      {recipeFormTagEditing ? (
                        <div className="tag-pill tag-pill-editor" onFocus={cancelEditorBlur} onBlur={scheduleEditorBlur}>
                          <input
                            autoFocus
                            value={recipeFormTagDraft}
                            placeholder={t(locale, 'tags')}
                            className="tag-pill-input"
                            onBlur={handleRecipeFormTagBlur}
                            onFocus={() => {
                              cancelEditorBlur()
                              setActiveEditorField({ scope: 'form', kind: 'tag' })
                            }}
                            onChange={(event) => setRecipeFormTagDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter') return
                              event.preventDefault()
                              commitRecipeFormTag()
                            }}
                          />
                          {activeEditorField?.scope === 'form' && activeEditorField.kind === 'tag' ? renderFieldSuggestions(activeEditorField) : null}
                        </div>
                      ) : null}
                      <button className="secondary-button icon-button" onClick={beginRecipeFormTagEdit} aria-label={t(locale, 'add')} title={t(locale, 'add')}>
                        <span aria-hidden="true">+</span>
                      </button>
                    </div>
                  </div>
                  <div className="ingredient-editor">
                    <div className="ingredient-table-shell">
                    <div className="ingredient-table-wrap">
                    <table className="ingredient-table ingredient-table-compact">
                      <colgroup>
                        <col className="ingredient-col-name" />
                        <col className="ingredient-col-quantity" />
                        <col className="ingredient-col-unit" />
                        <col className="ingredient-col-group" />
                        <col className="ingredient-col-remove" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>{t(locale, 'ingredient')}</th>
                          <th>{t(locale, 'quantity')}</th>
                          <th>{t(locale, 'unit')}</th>
                          <th>{t(locale, 'group')}</th>
                          <th aria-label={t(locale, 'close')}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipeFormEditableIngredients.map((ingredient, index) => (
                          <tr key={`recipe-form-ingredient-${index}`}>
                            <td>
                              <div className="field-with-suggestions" onFocus={cancelEditorBlur} onBlur={scheduleEditorBlur}>
                                <textarea
                                  value={ingredient.name}
                                  placeholder={t(locale, 'ingredient')}
                                  className="ingredient-table-input ingredient-table-textarea"
                                  rows={1}
                                  onInput={autoResizeTextarea}
                                  onFocus={(event) => {
                                    cancelEditorBlur()
                                    setActiveIngredientQuery(event.target.value)
                                    setActiveEditorField({ scope: 'form', kind: 'ingredient', index })
                                  }}
                                  onChange={(event) => {
                                    setActiveIngredientQuery(event.target.value)
                                    updateRecipeFormIngredient(index, 'name', event.target.value)
                                  }}
                                />
                                {activeEditorField?.scope === 'form' && activeEditorField.kind === 'ingredient' && activeEditorField.index === index ? renderFieldSuggestions(activeEditorField) : null}
                              </div>
                            </td>
                            <td>
                              <textarea
                                value={ingredient.quantity}
                                placeholder={t(locale, 'quantity')}
                                className="ingredient-table-input ingredient-table-textarea"
                                rows={1}
                                onInput={autoResizeTextarea}
                                onChange={(event) => updateRecipeFormIngredient(index, 'quantity', event.target.value)}
                              />
                            </td>
                            <td>
                              <textarea
                                value={ingredient.unit}
                                placeholder={t(locale, 'unit')}
                                className="ingredient-table-input ingredient-table-textarea"
                                rows={1}
                                onInput={autoResizeTextarea}
                                onChange={(event) => updateRecipeFormIngredient(index, 'unit', event.target.value)}
                              />
                            </td>
                            <td>
                              <div className="field-with-suggestions" onFocus={cancelEditorBlur} onBlur={scheduleEditorBlur}>
                                <textarea
                                  value={ingredient.group}
                                  placeholder={t(locale, 'group')}
                                  className="ingredient-table-input ingredient-table-textarea"
                                  rows={1}
                                  onInput={autoResizeTextarea}
                                  onFocus={(event) => {
                                    cancelEditorBlur()
                                    setActiveGroupQuery(event.target.value)
                                    setActiveEditorField({ scope: 'form', kind: 'group', index })
                                  }}
                                  onChange={(event) => {
                                    setActiveGroupQuery(event.target.value)
                                    updateRecipeFormIngredient(index, 'group', event.target.value)
                                  }}
                                />
                                {activeEditorField?.scope === 'form' && activeEditorField.kind === 'group' && activeEditorField.index === index ? renderFieldSuggestions(activeEditorField) : null}
                              </div>
                            </td>
                            <td className="ingredient-remove-cell">
                              <button
                                className="ghost-button ingredient-remove-button"
                                onClick={() => removeRecipeFormIngredient(index)}
                                aria-label={t(locale, 'close')}
                                title={t(locale, 'close')}
                                disabled={recipeFormEditableIngredients.length === 1 && isIngredientDraftEmpty(ingredient)}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    </div>
                  </div>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={recipeForm.isFavorite} onChange={(event) => setRecipeForm((current) => ({ ...current, isFavorite: event.target.checked }))} />
                    <span>{t(locale, 'favorite')}</span>
                  </label>
                  <button className="primary-button" onClick={() => void handleCreateRecipe()}>{t(locale, 'addRecipe')}</button>
                </div>

                <div className="recipe-list">
                  {recipes.length === 0 ? <p>{t(locale, 'emptyRecipes')}</p> : null}
                  {recipes.map((recipe) => (
                    <article key={recipe.id} className="recipe-card">
                      <div className="recipe-card-header">
                        <div>
                          <h3>{recipe.name}</h3>
                          <p>{recipe.notes || recipe.url || t(locale, 'quickCreateRecipe')}</p>
                        </div>
                        {recipe.isFavorite ? <span className="badge">{t(locale, 'favorite')}</span> : null}
                      </div>
                      <div className="chip-row">
                        {recipe.tags.map((tag) => (
                          <span key={tag.id} className="chip">{tag.name}</span>
                        ))}
                      </div>
                      <ul className="ingredient-list">
                        {recipe.ingredients.map((ingredient) => (
                          <li key={ingredient.id}>
                            <span>{ingredient.name}</span>
                            <span>{ingredient.quantityText}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="recipe-metadata">
                        <span>{t(locale, 'usageCount')}: {recipe.usageCount ?? 0}</span>
                        <span>
                          {t(locale, 'lastMade')}: {recipe.lastMadeAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(recipe.lastMadeAt)) : '-'}
                        </span>
                        {recipe.url ? <a href={recipe.url} target="_blank" rel="noreferrer">{t(locale, 'openRecipe')}</a> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </article>
          </section>

          <section className={activeTab === 'history' || currentMobileTab === 'history' ? 'content-column' : 'content-column hidden'}>
            <article className="panel">
              <div className="panel-header">
                <h2>{t(locale, 'history')}</h2>
              </div>
              <div className="history-list">
                {weeks.length <= 1 ? <p>{t(locale, 'emptyHistory')}</p> : null}
                {weeks.map((item) => (
                  <button key={item.id} className={item.id === week.id ? 'history-card active' : 'history-card'} onClick={() => void handleWeekSelect(item.id)}>
                    <strong>{item.label}</strong>
                    <span>{item.highlights.join(' • ') || t(locale, 'planner')}</span>
                  </button>
                ))}
              </div>
            </article>
          </section>

          <aside className="sidebar-column">
            <article className="panel shopping-panel">
              <div className="panel-header">
                <h2>{t(locale, 'shoppingList')}</h2>
              </div>
              {renderShoppingContent(week)}
            </article>
          </aside>
        </main>
      )}

      {editingMeal ? (
        <div className="modal-backdrop">
          <div className="modal-card recipe-editor-modal">
            <div className="panel-header">
              <h3>{t(locale, 'addRecipe')}</h3>
              <button className="secondary-button icon-button" onClick={closeMealEditor} aria-label={t(locale, 'close')} title={t(locale, 'close')}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="recipe-editor-meta">
              <strong>{dayLabel(locale, editingMeal.dayOfWeek)} · {mealLabel(locale, editingMeal.mealType)}</strong>
              {recipeModalRecipeId ? <span className="badge">{t(locale, 'existingRecipe')}</span> : null}
            </div>
            <div className="meal-editor-form">
              <div className="recipe-name-field">
                <div className="recipe-name-row">
                  <input
                    value={recipeModalDraft.name}
                    placeholder={t(locale, 'mealName')}
                    className={recipeModalLocked ? 'field-readonly' : ''}
                    readOnly={recipeModalLocked}
                    tabIndex={recipeModalLocked ? -1 : undefined}
                    onBlur={() => void handleRecipeNameBlur()}
                    onChange={(event) => void handleRecipeNameInput(event.target.value)}
                  />
                  {recipeModalRecipeId && recipeModalLocked ? (
                    <button className="secondary-button" onClick={() => setRecipeModalLocked(false)}>{t(locale, 'editRecipe')}</button>
                  ) : null}
                </div>
                {recipeModalSuggestions.length > 0 ? (
                  <div className="suggestion-list recipe-modal-suggestions">
                    {recipeModalSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        className="suggestion-item"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          void applyRecipeSuggestion(suggestion)
                        }}
                      >
                        <strong>{suggestion.label}</strong>
                        <span>{suggestion.type === 'recipe' ? t(locale, 'recipes') : t(locale, 'history')}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="recipe-link-row">
                <input
                  value={recipeModalDraft.url}
                  placeholder={t(locale, 'recipeUrl')}
                  className={recipeModalLocked ? 'field-readonly' : ''}
                  readOnly={recipeModalLocked}
                  tabIndex={recipeModalLocked ? -1 : undefined}
                  onChange={(event) => setRecipeModalDraft((current) => ({ ...current, url: event.target.value }))}
                />
                {recipeModalDraft.url ? (
                  <a className="link-button icon-button" href={recipeModalDraft.url} target="_blank" rel="noreferrer" aria-label={t(locale, 'open')} title={t(locale, 'open')}>
                    <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <button className="secondary-button icon-button is-disabled" disabled aria-label={t(locale, 'open')} title={t(locale, 'open')}>
                    <span aria-hidden="true">↗</span>
                  </button>
                )}
              </div>
              <textarea
                value={recipeModalDraft.notes}
                placeholder={t(locale, 'notes')}
                rows={4}
                className={recipeModalLocked ? 'field-readonly' : ''}
                readOnly={recipeModalLocked}
                tabIndex={recipeModalLocked ? -1 : undefined}
                onChange={(event) => setRecipeModalDraft((current) => ({ ...current, notes: event.target.value }))}
              />
                <div className="tag-editor tag-row-field">
                  <div className="chip-row">
                    {recipeModalDraft.tags.map((tag) => (
                      <button key={tag} className="tag-pill" onClick={() => removeRecipeModalTag(tag)} disabled={recipeModalLocked}>
                        <span>{tag}</span>
                        <span aria-hidden="true">×</span>
                      </button>
                    ))}
                    {recipeModalTagEditing ? (
                      <div className="tag-pill tag-pill-editor" onFocus={cancelEditorBlur} onBlur={scheduleEditorBlur}>
                        <input
                          autoFocus
                          value={recipeModalTagDraft}
                          placeholder={t(locale, 'tags')}
                          className="tag-pill-input"
                          readOnly={recipeModalLocked}
                          tabIndex={recipeModalLocked ? -1 : undefined}
                          onBlur={handleRecipeModalTagBlur}
                          onFocus={() => {
                            cancelEditorBlur()
                            setActiveEditorField({ scope: 'modal', kind: 'tag' })
                          }}
                          onChange={(event) => setRecipeModalTagDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' || recipeModalLocked) return
                            event.preventDefault()
                            commitRecipeModalTag()
                          }}
                        />
                        {activeEditorField?.scope === 'modal' && activeEditorField.kind === 'tag' ? renderFieldSuggestions(activeEditorField) : null}
                      </div>
                    ) : null}
                    {!recipeModalLocked ? (
                      <button className="secondary-button icon-button" onClick={beginRecipeModalTagEdit} aria-label={t(locale, 'add')} title={t(locale, 'add')}>
                        <span aria-hidden="true">+</span>
                      </button>
                    ) : null}
                  </div>
                </div>
               <div className="ingredient-editor">
                 <div className="ingredient-table-shell">
                 <div className="ingredient-table-wrap">
                 <table className="ingredient-table ingredient-table-compact">
                   <colgroup>
                     <col className="ingredient-col-name" />
                     <col className="ingredient-col-quantity" />
                     <col className="ingredient-col-unit" />
                     <col className="ingredient-col-group" />
                     <col className="ingredient-col-remove" />
                   </colgroup>
                   <thead>
                     <tr>
                       <th>{t(locale, 'ingredient')}</th>
                       <th>{t(locale, 'quantity')}</th>
                       <th>{t(locale, 'unit')}</th>
                       <th>{t(locale, 'group')}</th>
                       <th aria-label={t(locale, 'close')}></th>
                     </tr>
                   </thead>
                   <tbody>
                     {recipeModalEditableIngredients.map((ingredient, index) => (
                       <tr key={`recipe-modal-ingredient-${index}`}>
                          <td>
                             <div className="field-with-suggestions" onFocus={cancelEditorBlur} onBlur={scheduleEditorBlur}>
                               <textarea
                                 value={ingredient.name}
                                 placeholder={t(locale, 'ingredient')}
                                 className={recipeModalLocked ? 'field-readonly ingredient-table-input ingredient-table-textarea' : 'ingredient-table-input ingredient-table-textarea'}
                                 rows={1}
                                 onInput={autoResizeTextarea}
                                 readOnly={recipeModalLocked}
                                 tabIndex={recipeModalLocked ? -1 : undefined}
                                 onFocus={(event) => {
                                   cancelEditorBlur()
                                   setActiveIngredientQuery(event.target.value)
                                   if (!recipeModalLocked) setActiveEditorField({ scope: 'modal', kind: 'ingredient', index })
                                 }}
                                 onChange={(event) => {
                                   setActiveIngredientQuery(event.target.value)
                                   updateRecipeModalIngredient(index, 'name', event.target.value)
                                 }}
                               />
                               {!recipeModalLocked && activeEditorField?.scope === 'modal' && activeEditorField.kind === 'ingredient' && activeEditorField.index === index ? renderFieldSuggestions(activeEditorField) : null}
                             </div>
                           </td>
                          <td>
                            <textarea
                              value={ingredient.quantity}
                              placeholder={t(locale, 'quantity')}
                              className={recipeModalLocked ? 'field-readonly ingredient-table-input ingredient-table-textarea' : 'ingredient-table-input ingredient-table-textarea'}
                              rows={1}
                              onInput={autoResizeTextarea}
                              readOnly={recipeModalLocked}
                              tabIndex={recipeModalLocked ? -1 : undefined}
                              onChange={(event) => updateRecipeModalIngredient(index, 'quantity', event.target.value)}
                            />
                          </td>
                          <td>
                            <textarea
                              value={ingredient.unit}
                              placeholder={t(locale, 'unit')}
                              className={recipeModalLocked ? 'field-readonly ingredient-table-input ingredient-table-textarea' : 'ingredient-table-input ingredient-table-textarea'}
                              rows={1}
                              onInput={autoResizeTextarea}
                              readOnly={recipeModalLocked}
                              tabIndex={recipeModalLocked ? -1 : undefined}
                              onChange={(event) => updateRecipeModalIngredient(index, 'unit', event.target.value)}
                            />
                          </td>
                          <td>
                            <div className="field-with-suggestions" onFocus={cancelEditorBlur} onBlur={scheduleEditorBlur}>
                              <textarea
                                value={ingredient.group}
                                placeholder={t(locale, 'group')}
                                className={recipeModalLocked ? 'field-readonly ingredient-table-input ingredient-table-textarea' : 'ingredient-table-input ingredient-table-textarea'}
                                rows={1}
                                onInput={autoResizeTextarea}
                                readOnly={recipeModalLocked}
                                tabIndex={recipeModalLocked ? -1 : undefined}
                                onFocus={(event) => {
                                  cancelEditorBlur()
                                  setActiveGroupQuery(event.target.value)
                                  if (!recipeModalLocked) setActiveEditorField({ scope: 'modal', kind: 'group', index })
                                }}
                                onChange={(event) => {
                                  setActiveGroupQuery(event.target.value)
                                  updateRecipeModalIngredient(index, 'group', event.target.value)
                                }}
                              />
                              {!recipeModalLocked && activeEditorField?.scope === 'modal' && activeEditorField.kind === 'group' && activeEditorField.index === index ? renderFieldSuggestions(activeEditorField) : null}
                            </div>
                          </td>
                          <td className="ingredient-remove-cell">
                            {!recipeModalLocked ? (
                              <button
                                className="ghost-button ingredient-remove-button"
                                onClick={() => removeRecipeModalIngredient(index)}
                                aria-label={t(locale, 'close')}
                                title={t(locale, 'close')}
                                disabled={recipeModalEditableIngredients.length === 1 && isIngredientDraftEmpty(ingredient)}
                              >
                                ×
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                 </div>
               </div>
              <label className={recipeModalLocked ? 'checkbox-row recipe-form-locked' : 'checkbox-row'}>
                <input
                  type="checkbox"
                  checked={recipeModalDraft.isFavorite}
                  disabled={recipeModalLocked}
                  onChange={(event) => setRecipeModalDraft((current) => ({ ...current, isFavorite: event.target.checked }))}
                />
                <span>{t(locale, 'favorite')}</span>
              </label>
            </div>
            {recipeModalError ? <p className="form-error">{recipeModalError}</p> : null}
            <div className="modal-actions">
              <button className="secondary-button" onClick={closeMealEditor}>{t(locale, 'close')}</button>
              <button className={recipeModalSaving ? 'primary-button is-disabled' : 'primary-button'} onClick={() => void handleMealRecipeSave()} disabled={recipeModalSaving}>
                {recipeModalSaving ? `${t(locale, 'save')}...` : t(locale, 'save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="modal-backdrop" onClick={closeSettings}>
          <div className="modal-card settings-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <h3>{t(locale, 'settings')}</h3>
              <button className="secondary-button icon-button" onClick={closeSettings} aria-label={t(locale, 'close')}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <p className="settings-copy">{t(locale, 'accentColor')}</p>
            <div className="accent-grid">
              {CATPPUCCIN_ACCENTS.map((accent) => (
                <button
                  key={accent}
                  className={accentDraft === accent ? 'accent-option active' : 'accent-option'}
                  onClick={() => {
                    setAccentDraft(accent)
                    document.documentElement.style.setProperty('--accent', `var(--ctp-${accent})`)
                  }}
                >
                  <span className="settings-color-swatch" style={{ background: `var(--ctp-${accent})` }} />
                  <span>{t(locale, accent)}</span>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={resetAccent}>{t(locale, 'resetColors')}</button>
              <button className="primary-button" onClick={applyAccentDraft}>{t(locale, 'save')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {weekPickerOpen ? (
        <div className="modal-backdrop" onClick={() => setWeekPickerOpen(false)}>
          <div className="modal-card week-picker-modal" onClick={(event) => event.stopPropagation()}>
            <div className="panel-header">
              <h3>{t(locale, 'newWeek')}</h3>
              <button className="secondary-button icon-button" onClick={() => setWeekPickerOpen(false)} aria-label={t(locale, 'close')}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="calendar-header">
              <button className="secondary-button icon-button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label={t(locale, 'previousMonth')}>
                <span aria-hidden="true">‹</span>
              </button>
              <strong>{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(calendarMonth)}</strong>
              <button className="secondary-button icon-button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label={t(locale, 'nextMonth')}>
                <span aria-hidden="true">›</span>
              </button>
            </div>
            <div className="calendar-grid calendar-grid-head">
              {DAYS.map((day) => (
                <span key={day} className="calendar-weekday">{dayLabel(locale, day).slice(0, 3)}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {calendarDays.map((day) => {
                const isToday = sameDate(day, today)
                const isSelected = sameDate(day, selectedCalendarDate)
                const isOutsideMonth = day.getMonth() !== calendarMonth.getMonth()
                return (
                  <button
                    key={day.toISOString()}
                    className={[
                      'calendar-day-button',
                      isToday ? 'today' : '',
                      isSelected ? 'selected' : '',
                      isOutsideMonth ? 'outside-month' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => setSelectedCalendarDate(day)}
                  >
                    <span>{day.getDate()}</span>
                    {isToday ? <small>{t(locale, 'today')}</small> : null}
                  </button>
                )
              })}
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setWeekPickerOpen(false)}>{t(locale, 'close')}</button>
              <button className="primary-button" onClick={() => void handleCreateWeek()}>{t(locale, 'openWeek')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {mealActionMeal ? (
        <div className="modal-backdrop">
          <div className="modal-card meal-action-modal">
            <p>{t(locale, 'mealActionPrompt')}</p>
            <p><strong>{mealDisplayTitle(mealActionMeal)}</strong></p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setMealActionMeal(null)}>{t(locale, 'close')}</button>
              <button className="secondary-button" onClick={handleMealActionEdit}>{t(locale, 'editMeal')}</button>
              {mealActionMeal.recipeUrl ? (
                <a className="primary-button" href={mealActionMeal.recipeUrl} target="_blank" rel="noreferrer" onClick={() => setMealActionMeal(null)}>
                  {t(locale, 'open')}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {ingredientConfirmDialog ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>{t(locale, 'ingredientConfirmPrompt')}</h3>
            <p>{ingredientConfirmDialog.recipe.name}</p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setIngredientConfirmDialog(null)}>{t(locale, 'skipIngredients')}</button>
              <button className="primary-button" onClick={handleOpenIngredientPicker}>{t(locale, 'chooseIngredients')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {ingredientDialog ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>{t(locale, 'ingredientPrompt')}</h3>
            <p>{ingredientDialog.recipe.name}</p>
            <div className="modal-list">
              {ingredientDialog.recipe.ingredients.map((ingredient) => (
                <label key={ingredient.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedIngredientIds.includes(ingredient.ingredientId)}
                    onChange={(event) =>
                      setSelectedIngredientIds((current) =>
                        event.target.checked
                          ? [...current, ingredient.ingredientId]
                          : current.filter((item) => item !== ingredient.ingredientId),
                      )
                    }
                  />
                  <span>
                    {ingredient.name}
                    {ingredient.quantityText ? ` · ${ingredient.quantityText}` : ''}
                    {ingredient.isPantryStaple ? ` · ${t(locale, 'pantryStaple')}` : ''}
                  </span>
                </label>
              ))}
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setIngredientDialog(null)}>{t(locale, 'close')}</button>
              <button className="primary-button" onClick={() => void handleConfirmIngredients()}>{t(locale, 'confirmIngredients')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
