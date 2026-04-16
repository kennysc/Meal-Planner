import { Fragment, useEffect, useRef, useState } from 'react'
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
type RecipeDraft = {
  name: string
  url: string
  notes: string
  tags: string
  ingredients: string
  isFavorite: boolean
}

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
const EMPTY_RECIPE_DRAFT: RecipeDraft = { name: '', url: '', notes: '', tags: '', ingredients: '', isFavorite: false }

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

function recipeToDraft(recipe: Recipe): RecipeDraft {
  return {
    name: recipe.name,
    url: recipe.url ?? '',
    notes: recipe.notes,
    tags: recipe.tags.map((tag) => tag.name).join(', '),
    ingredients: recipe.ingredients
      .map((ingredient) => [ingredient.name, ingredient.quantityText, ingredient.isPantryStaple ? 'pantry' : ''].filter(Boolean).join('|'))
      .join('\n'),
    isFavorite: recipe.isFavorite,
  }
}

function emptyRecipeDraftWithName(name: string): RecipeDraft {
  return { ...EMPTY_RECIPE_DRAFT, name }
}

function parseRecipeDraft(draft: RecipeDraft) {
  return {
    name: draft.name.trim(),
    url: draft.url.trim(),
    notes: draft.notes.trim(),
    isFavorite: draft.isFavorite,
    tags: splitList(draft.tags),
    ingredients: draft.ingredients
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name = '', quantityText = '', pantryFlag = ''] = line.split('|').map((part) => part?.trim() ?? '')
        return {
          name,
          quantityText: quantityText || undefined,
          isPantryStaple: ['pantry', 'garde-manger', 'true', 'yes', 'oui'].includes(pantryFlag.toLowerCase()),
        }
      }),
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
  const [linkConfirmMeal, setLinkConfirmMeal] = useState<Meal | null>(null)
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [recipeModalDraft, setRecipeModalDraft] = useState<RecipeDraft>(EMPTY_RECIPE_DRAFT)
  const [recipeModalRecipeId, setRecipeModalRecipeId] = useState<string | null>(null)
  const [recipeModalLocked, setRecipeModalLocked] = useState(false)
  const [recipeModalSuggestions, setRecipeModalSuggestions] = useState<Suggestion[]>([])
  const [recipeModalSaving, setRecipeModalSaving] = useState(false)
  const [recipeModalError, setRecipeModalError] = useState<string | null>(null)
  const [recipeModalDebug, setRecipeModalDebug] = useState('idle')
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
  const [recipeForm, setRecipeForm] = useState<RecipeDraft>({ ...EMPTY_RECIPE_DRAFT, ingredients: 'Poulet|2 poitrines' })
  const recipeModalSelectedRecipeRef = useRef<Recipe | null>(null)
  const recipeSuggestionRequestRef = useRef(0)

  function setRecipeDebug(message: string) {
    console.log('[recipe-modal]', message)
    setRecipeModalDebug(message)
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
      tags: '',
      ingredients: '',
      isFavorite: false,
    })
    setRecipeModalRecipeId(null)
    setRecipeModalLocked(false)
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
  const desktopTabs: DesktopTab[] = ['planner', 'recipes', 'history']
  const currentMobileTab = activeTab === 'planner' ? 'dinner' : (mobilePlannerTabs.includes(activeTab as MobileTab) ? activeTab as MobileTab : 'dinner')
  const today = new Date()
  const calendarDays = buildCalendarDays(calendarMonth)

  function renderMealCard(meal: Meal) {
    return (
      <div
        key={meal.id}
        className={meal.recipeUrl ? 'meal-card meal-card-clickable' : 'meal-card'}
        onClick={() => { if (meal.recipeUrl) setLinkConfirmMeal(meal) }}
      >
        <div className="meal-summary">
          <strong>{meal.title.trim() || t(locale, 'mealName')}</strong>
        </div>
        <div className="meal-card-actions">
          <button
            className="secondary-button icon-button"
            onClick={(event) => { event.stopPropagation(); openMealEditor(meal.id) }}
            aria-label={t(locale, 'edit')}
            title={t(locale, 'edit')}
          >
            <span aria-hidden="true">✎</span>
          </button>
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

      <nav className="tab-bar tab-bar-desktop">
        {desktopTabs.map((tab) => (
          <button key={tab} className={activeTab === tab ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab(tab)}>
            {t(locale, tab)}
          </button>
        ))}
      </nav>

      <nav className="tab-bar tab-bar-mobile">
        <button className={currentMobileTab === 'dinner' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('dinner')}>
          {mealLabel(locale, 'DINNER')}
        </button>
        <button className={currentMobileTab === 'supper' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('supper')}>
          {mealLabel(locale, 'SUPPER')}
        </button>
        <button className={currentMobileTab === 'shopping' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('shopping')}>
          {t(locale, 'shoppingList')}
        </button>
        <button className={currentMobileTab === 'recipes' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('recipes')}>
          {t(locale, 'recipes')}
        </button>
        <button className={currentMobileTab === 'history' ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab('history')}>
          {t(locale, 'history')}
        </button>
      </nav>

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
                  <input value={recipeForm.tags} placeholder="Rapide, BBQ, Familial" onChange={(event) => setRecipeForm((current) => ({ ...current, tags: event.target.value }))} />
                  <textarea value={recipeForm.ingredients} rows={5} placeholder={'Poulet|2 poitrines\nRiz|2 tasses'} onChange={(event) => setRecipeForm((current) => ({ ...current, ingredients: event.target.value }))} />
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
              <input
                value={recipeModalDraft.url}
                placeholder={t(locale, 'recipeUrl')}
                readOnly={recipeModalLocked}
                onChange={(event) => setRecipeModalDraft((current) => ({ ...current, url: event.target.value }))}
              />
              <textarea
                value={recipeModalDraft.notes}
                placeholder={t(locale, 'notes')}
                rows={4}
                readOnly={recipeModalLocked}
                onChange={(event) => setRecipeModalDraft((current) => ({ ...current, notes: event.target.value }))}
              />
              <input
                value={recipeModalDraft.tags}
                placeholder={t(locale, 'tags')}
                readOnly={recipeModalLocked}
                onChange={(event) => setRecipeModalDraft((current) => ({ ...current, tags: event.target.value }))}
              />
              <textarea
                value={recipeModalDraft.ingredients}
                placeholder={'Poulet|2 poitrines\nRiz|2 tasses\nBeurre||pantry'}
                rows={6}
                readOnly={recipeModalLocked}
                onChange={(event) => setRecipeModalDraft((current) => ({ ...current, ingredients: event.target.value }))}
              />
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
            <p className="form-debug">{recipeModalDebug}</p>
            <div className="modal-actions">
              {recipeModalDraft.url ? (
                <a className="link-button icon-button" href={recipeModalDraft.url} target="_blank" rel="noreferrer" aria-label={t(locale, 'openRecipe')} title={t(locale, 'openRecipe')}>
                  <span aria-hidden="true">↗</span>
                </a>
              ) : null}
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

      {linkConfirmMeal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <p>{t(locale, 'openLinkConfirm')}</p>
            <p><strong>{linkConfirmMeal.title}</strong></p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setLinkConfirmMeal(null)}>{t(locale, 'close')}</button>
              <a className="primary-button" href={linkConfirmMeal.recipeUrl ?? ''} target="_blank" rel="noreferrer" onClick={() => setLinkConfirmMeal(null)}>
                {t(locale, 'open')}
              </a>
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
