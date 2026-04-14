import { Fragment, useEffect, useRef, useState } from 'react'
import './App.css'
import {
  addRecipeIngredients,
  addShoppingItem,
  createRecipe,
  deleteShoppingItem,
  fetchCurrentWeek,
  fetchRecipes,
  fetchSuggestions,
  fetchWeek,
  fetchWeeks,
  updateMeal,
  updateShoppingItem,
} from './api'
import { dayLabel, mealLabel, t } from './i18n'
import type { Locale, Meal, MealStatus, MealType, Recipe, ShoppingItem, Suggestion, Week, WeekSummary } from './types'

// ── Desktop tabs ──────────────────────────────────────────────────────────────
type DesktopTab = 'planner' | 'recipes' | 'history'
// ── Mobile tabs (planner split + shopping moved here) ────────────────────────
type MobileTab = 'dinner' | 'supper' | 'shopping' | 'recipes' | 'history'
type ActiveTab = DesktopTab | MobileTab

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const

function App() {
  const [locale, setLocale] = useState<Locale>('fr-CA')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    return window.localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
  })
  const [settingsOpen, setSettingsOpen] = useState(false)

  const DARK_DEFAULTS = { color1: '#240750', color2: '#344C64', color3: '#577B8D', color4: '#57A6A1' }
  const LIGHT_DEFAULTS = { color1: '#e8f0f3', color2: '#d0e2ea', color3: '#577B8D', color4: '#57A6A1' }

  const [darkColors, setDarkColors] = useState(() => ({
    color1: window.localStorage.getItem('dark-color1') ?? DARK_DEFAULTS.color1,
    color2: window.localStorage.getItem('dark-color2') ?? DARK_DEFAULTS.color2,
    color3: window.localStorage.getItem('dark-color3') ?? DARK_DEFAULTS.color3,
    color4: window.localStorage.getItem('dark-color4') ?? DARK_DEFAULTS.color4,
  }))
  const [lightColors, setLightColors] = useState(() => ({
    color1: window.localStorage.getItem('light-color1') ?? LIGHT_DEFAULTS.color1,
    color2: window.localStorage.getItem('light-color2') ?? LIGHT_DEFAULTS.color2,
    color3: window.localStorage.getItem('light-color3') ?? LIGHT_DEFAULTS.color3,
    color4: window.localStorage.getItem('light-color4') ?? LIGHT_DEFAULTS.color4,
  }))
  // Draft state for settings inputs (not applied until user edits)
  const [colorDraft, setColorDraft] = useState({ color1: '', color2: '', color3: '', color4: '' })

  const [activeTab, setActiveTab] = useState<ActiveTab>('planner')
  const [week, setWeek] = useState<Week | null>(null)
  const [weeks, setWeeks] = useState<WeekSummary[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mealDrafts, setMealDrafts] = useState<Record<string, Partial<Meal>>>({})
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>({})
  const [openSuggestionId, setOpenSuggestionId] = useState<string | null>(null)
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [ingredientDialog, setIngredientDialog] = useState<{ mealId: string; recipe: Recipe } | null>(null)
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([])
  const [linkConfirmMeal, setLinkConfirmMeal] = useState<Meal | null>(null)
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [recipeSearch, setRecipeSearch] = useState('')
  const [tagSearch, setTagSearch] = useState('')
  const [ingredientSearch, setIngredientSearch] = useState('')
  const [ingredientMode, setIngredientMode] = useState<'any' | 'all'>('any')
  const [shoppingDraft, setShoppingDraft] = useState('')
  const [recipeForm, setRecipeForm] = useState({
    name: '',
    url: '',
    notes: '',
    tags: '',
    ingredients: 'Poulet|2 poitrines',
    isFavorite: false,
  })

  useEffect(() => {
    void loadDashboard(locale)
  }, [locale])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const colors = theme === 'dark' ? darkColors : lightColors
    const root = document.documentElement
    root.style.setProperty('--color-1', colors.color1)
    root.style.setProperty('--color-2', colors.color2)
    root.style.setProperty('--color-3', colors.color3)
    root.style.setProperty('--color-4', colors.color4)
  }, [theme, darkColors, lightColors])

  function applyColorDraft() {
    const isValidHex = (v: string) => /^#[0-9a-fA-F]{3,8}$/.test(v)
    const prefix = theme === 'dark' ? 'dark' : 'light'
    const current = theme === 'dark' ? darkColors : lightColors
    const next = {
      color1: isValidHex(colorDraft.color1) ? colorDraft.color1 : current.color1,
      color2: isValidHex(colorDraft.color2) ? colorDraft.color2 : current.color2,
      color3: isValidHex(colorDraft.color3) ? colorDraft.color3 : current.color3,
      color4: isValidHex(colorDraft.color4) ? colorDraft.color4 : current.color4,
    }
    window.localStorage.setItem(`${prefix}-color1`, next.color1)
    window.localStorage.setItem(`${prefix}-color2`, next.color2)
    window.localStorage.setItem(`${prefix}-color3`, next.color3)
    window.localStorage.setItem(`${prefix}-color4`, next.color4)
    if (theme === 'dark') setDarkColors(next)
    else setLightColors(next)
  }

  function resetColors() {
    const prefix = theme === 'dark' ? 'dark' : 'light'
    const defaults = theme === 'dark' ? DARK_DEFAULTS : LIGHT_DEFAULTS
    ;(['color1', 'color2', 'color3', 'color4'] as const).forEach((k) => {
      window.localStorage.removeItem(`${prefix}-${k}`)
    })
    if (theme === 'dark') setDarkColors({ ...defaults })
    else setLightColors({ ...defaults })
    setColorDraft({ color1: '', color2: '', color3: '', color4: '' })
  }

  function openSettings() {
    const current = theme === 'dark' ? darkColors : lightColors
    setColorDraft({ ...current })
    setSettingsOpen(true)
  }

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
      setMealDrafts({})
      setSuggestions({})
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load app')
    } finally {
      setLoading(false)
    }
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

  function splitList(value: string) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  function mealState(meal: Meal) {
    return { ...meal, ...mealDrafts[meal.id] }
  }

  async function handleMealFieldChange(meal: Meal, field: keyof Meal, value: string | MealStatus | null) {
    setMealDrafts((current) => ({
      ...current,
      [meal.id]: {
        ...current[meal.id],
        [field]: value,
      },
    }))

    if (field === 'title' && typeof value === 'string' && value.trim().length >= 2) {
      const response = await fetchSuggestions(value)
      setSuggestions((current) => ({ ...current, [meal.id]: response.suggestions }))
      setOpenSuggestionId(meal.id)
    }
  }

  function applySuggestion(meal: Meal, suggestion: Suggestion) {
    setMealDrafts((current) => ({
      ...current,
      [meal.id]: {
        ...current[meal.id],
        title: suggestion.label,
        recipeId: suggestion.recipeId,
        recipeUrl: suggestion.recipeUrl,
      },
    }))
    setOpenSuggestionId(null)
  }

  function openMealEditor(mealId: string) {
    setEditingMealId(mealId)
    setOpenSuggestionId(null)
  }

  function closeMealEditor() {
    setEditingMealId(null)
    setOpenSuggestionId(null)
  }

  async function handleMealSave(meal: Meal) {
    if (!week) return
    const draft = mealState(meal)
    const response = await updateMeal(week.id, meal.id, {
      title: draft.title ?? '',
      notes: draft.notes ?? '',
      status: draft.status ?? 'PLANNED',
      recipeId: draft.recipeId ?? null,
      recipeUrl: draft.recipeUrl ?? null,
    })

    const updatedMeal = response.meal
    setWeek((current) =>
      current
        ? {
            ...current,
            meals: current.meals.map((item) => (item.id === meal.id ? updatedMeal : item)),
          }
        : current,
    )
    setMealDrafts((current) => {
      const next = { ...current }
      delete next[meal.id]
      return next
    })

    if (!updatedMeal.recipeId && updatedMeal.title.trim()) {
      const shouldCreate = window.confirm(t(locale, 'createRecipePrompt'))
      if (shouldCreate) {
        const created = await createRecipe({
          name: updatedMeal.title,
          url: updatedMeal.recipeUrl ?? undefined,
          notes: updatedMeal.notes,
          tags: [],
          ingredients: [],
        })

        const linked = await updateMeal(week.id, meal.id, {
          recipeId: created.recipe.id,
          recipeUrl: created.recipe.url,
          title: created.recipe.name,
          notes: updatedMeal.notes,
          status: updatedMeal.status,
        })

        setRecipes((current) => [created.recipe, ...current])
        setWeek((current) =>
          current
            ? {
                ...current,
                meals: current.meals.map((item) => (item.id === meal.id ? linked.meal : item)),
              }
            : current,
        )
      }
      return
    }

    if (updatedMeal.recipe && updatedMeal.recipe.ingredients.length > 0) {
      setIngredientDialog({ mealId: updatedMeal.id, recipe: updatedMeal.recipe })
      setSelectedIngredientIds(
        updatedMeal.recipe.ingredients
          .filter((ingredient) => !ingredient.isPantryStaple)
          .map((ingredient) => ingredient.ingredientId),
      )
    }
  }

  async function handleMealEditorSave(meal: Meal) {
    await handleMealSave(meal)
    closeMealEditor()
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
    const created = await createRecipe({
      name: recipeForm.name,
      url: recipeForm.url,
      notes: recipeForm.notes,
      isFavorite: recipeForm.isFavorite,
      tags: splitList(recipeForm.tags),
      ingredients: recipeForm.ingredients
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, quantityText] = line.split('|')
          return { name: name.trim(), quantityText: quantityText?.trim() }
        }),
    })

    setRecipeForm({ name: '', url: '', notes: '', tags: '', ingredients: '', isFavorite: false })
    setRecipes((current) => [created.recipe, ...current])
    setActiveTab('recipes')
  }

  async function handleWeekSelect(weekId: string) {
    const response = await fetchWeek(weekId, locale)
    setWeek(response.week)
    // Go to planner on desktop, dinner on mobile — CSS handles which tab bar is shown
    setActiveTab('planner')
  }

  // Group meals by day for the desktop planner grid
  const groupedMeals = (week?.meals ?? []).reduce<Record<string, Meal[]>>((accumulator, meal) => {
    accumulator[meal.dayOfWeek] = [...(accumulator[meal.dayOfWeek] ?? []), meal]
    return accumulator
  }, {})

  // Group meals by day+mealType for quick lookup in mobile columns
  const mealByDayAndType = (week?.meals ?? []).reduce<Record<string, Meal>>((accumulator, meal) => {
    accumulator[`${meal.dayOfWeek}:${meal.mealType}`] = meal
    return accumulator
  }, {})

  const editingMeal = week?.meals.find((meal) => meal.id === editingMealId) ?? null
  const editingDraft = editingMeal ? mealState(editingMeal) : null

  // ── Render helpers (plain functions, not components — avoids remount on render) ──

  function renderMealCard(meal: Meal) {
    const draft = mealState(meal)
    return (
      <div
        key={meal.id}
        className={draft.recipeUrl ? 'meal-card meal-card-clickable' : 'meal-card'}
        onClick={() => { if (draft.recipeUrl) setLinkConfirmMeal(meal) }}
      >
        <div className="meal-summary">
          <strong>{draft.title?.trim() || t(locale, 'mealName')}</strong>
        </div>
        <div className="meal-card-actions">
          <button
            className="secondary-button icon-button"
            onClick={(e) => { e.stopPropagation(); openMealEditor(meal.id) }}
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
                className={[
                  'shopping-item',
                  item.checked ? 'checked' : '',
                  dragOverIndex === index ? 'drag-over' : '',
                ].filter(Boolean).join(' ')}
                draggable
                onDragStart={() => handleShoppingDragStart(index)}
                onDragOver={(e) => handleShoppingDragOver(e, index)}
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

  // ── Tab helpers ────────────────────────────────────────────────────────────
  // On mobile, 'planner' maps to 'dinner' so clicking history→planner on desktop
  // then switching to mobile still shows a planner tab as active.
  const mobilePlannerTabs: MobileTab[] = ['dinner', 'supper', 'shopping', 'recipes', 'history']
  const desktopTabs: DesktopTab[] = ['planner', 'recipes', 'history']

  // Determine which mobile tab is "active" when activeTab is a desktop-only value
  function effectiveMobileTab(): MobileTab {
    if (activeTab === 'planner') return 'dinner'
    if ((mobilePlannerTabs as ActiveTab[]).includes(activeTab)) return activeTab as MobileTab
    return 'dinner'
  }

  const currentMobileTab = effectiveMobileTab()

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
          <button
            className="header-pill-button"
            onClick={openSettings}
            aria-label={t(locale, 'settings')}
            title={t(locale, 'settings')}
          >
            ⚙
          </button>
        </div>
      </header>

      {/* ── Desktop tab bar (hidden on mobile via CSS) ── */}
      <nav className="tab-bar tab-bar-desktop">
        {desktopTabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab(tab)}
          >
            {t(locale, tab)}
          </button>
        ))}
      </nav>

      {/* ── Mobile tab bar (hidden on desktop via CSS) ── */}
      <nav className="tab-bar tab-bar-mobile">
        <button
          className={currentMobileTab === 'dinner' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('dinner')}
        >
          {mealLabel(locale, 'DINNER')}
        </button>
        <button
          className={currentMobileTab === 'supper' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('supper')}
        >
          {mealLabel(locale, 'SUPPER')}
        </button>
        <button
          className={currentMobileTab === 'shopping' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('shopping')}
        >
          {t(locale, 'shoppingList')}
        </button>
        <button
          className={currentMobileTab === 'recipes' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('recipes')}
        >
          {t(locale, 'recipes')}
        </button>
        <button
          className={currentMobileTab === 'history' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('history')}
        >
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
          {/* ── Desktop planner (hidden on mobile) ── */}
          <section className={activeTab === 'planner' ? 'content-column desktop-only' : 'content-column desktop-only hidden'}>
            <article className="panel planner-panel">
              <div className="panel-header">
                <h2>{t(locale, 'planner')}</h2>
              </div>

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
                    {(groupedMeals[day] ?? [])
                      .sort((left, right) => left.mealType.localeCompare(right.mealType))
                      .map((meal) => renderMealCard(meal))}
                  </Fragment>
                ))}
              </div>
            </article>
          </section>

          {/* ── Mobile: Dinner column (hidden on desktop) ── */}
          <section className={currentMobileTab === 'dinner' ? 'content-column mobile-only' : 'content-column mobile-only hidden'}>
            <article className="panel planner-panel">
              <div className="panel-header">
                <h2>{mealLabel(locale, 'DINNER')}</h2>
              </div>
              {renderMobileMealColumn('DINNER')}
            </article>
          </section>

          {/* ── Mobile: Supper column (hidden on desktop) ── */}
          <section className={currentMobileTab === 'supper' ? 'content-column mobile-only' : 'content-column mobile-only hidden'}>
            <article className="panel planner-panel">
              <div className="panel-header">
                <h2>{mealLabel(locale, 'SUPPER')}</h2>
              </div>
              {renderMobileMealColumn('SUPPER')}
            </article>
          </section>

          {/* ── Mobile: Shopping tab (hidden on desktop) ── */}
          <section className={currentMobileTab === 'shopping' ? 'content-column mobile-only' : 'content-column mobile-only hidden'}>
            <article className="panel shopping-panel">
              <div className="panel-header">
                <h2>{t(locale, 'shoppingList')}</h2>
              </div>
              {renderShoppingContent(week)}
            </article>
          </section>

          {/* ── Recipes tab (desktop + mobile) ── */}
          <section
            className={
              activeTab === 'recipes' || currentMobileTab === 'recipes'
                ? 'content-column'
                : 'content-column hidden'
            }
          >
            <article className="panel">
              <div className="panel-header">
                <h2>{t(locale, 'recipes')}</h2>
              </div>

              <div className="recipe-toolbar">
                <input
                  value={recipeSearch}
                  placeholder={t(locale, 'searchRecipes')}
                  onChange={(event) => setRecipeSearch(event.target.value)}
                />
                <input
                  value={tagSearch}
                  placeholder={t(locale, 'searchTags')}
                  onChange={(event) => setTagSearch(event.target.value)}
                />
                <input
                  value={ingredientSearch}
                  placeholder={t(locale, 'searchIngredients')}
                  onChange={(event) => setIngredientSearch(event.target.value)}
                />
                <select value={ingredientMode} onChange={(event) => setIngredientMode(event.target.value as 'any' | 'all')}>
                  <option value="any">{t(locale, 'matchAny')}</option>
                  <option value="all">{t(locale, 'matchAll')}</option>
                </select>
                <button className="primary-button" onClick={() => void refreshRecipes()}>
                  {t(locale, 'searchRecipes')}
                </button>
              </div>

              <div className="recipe-layout">
                <div className="recipe-form">
                  <h3>{t(locale, 'addRecipe')}</h3>
                  <input
                    value={recipeForm.name}
                    placeholder={t(locale, 'mealName')}
                    onChange={(event) => setRecipeForm((current) => ({ ...current, name: event.target.value }))}
                  />
                  <input
                    value={recipeForm.url}
                    placeholder={t(locale, 'recipeUrl')}
                    onChange={(event) => setRecipeForm((current) => ({ ...current, url: event.target.value }))}
                  />
                  <textarea
                    value={recipeForm.notes}
                    rows={3}
                    placeholder={t(locale, 'notes')}
                    onChange={(event) => setRecipeForm((current) => ({ ...current, notes: event.target.value }))}
                  />
                  <input
                    value={recipeForm.tags}
                    placeholder="Rapide, BBQ, Familial"
                    onChange={(event) => setRecipeForm((current) => ({ ...current, tags: event.target.value }))}
                  />
                  <textarea
                    value={recipeForm.ingredients}
                    rows={5}
                    placeholder={'Poulet|2 poitrines\nRiz|2 tasses'}
                    onChange={(event) => setRecipeForm((current) => ({ ...current, ingredients: event.target.value }))}
                  />
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={recipeForm.isFavorite}
                      onChange={(event) => setRecipeForm((current) => ({ ...current, isFavorite: event.target.checked }))}
                    />
                    <span>{t(locale, 'favorite')}</span>
                  </label>
                  <button className="primary-button" onClick={() => void handleCreateRecipe()}>
                    {t(locale, 'addRecipe')}
                  </button>
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
                          <span key={tag.id} className="chip">
                            {tag.name}
                          </span>
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
                        <span>
                          {t(locale, 'usageCount')}: {recipe.usageCount ?? 0}
                        </span>
                        <span>
                          {t(locale, 'lastMade')}:{' '}
                          {recipe.lastMadeAt
                            ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(recipe.lastMadeAt))
                            : '-'}
                        </span>
                        {recipe.url ? (
                          <a href={recipe.url} target="_blank" rel="noreferrer">
                            {t(locale, 'openRecipe')}
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </article>
          </section>

          {/* ── History tab (desktop + mobile) ── */}
          <section
            className={
              activeTab === 'history' || currentMobileTab === 'history'
                ? 'content-column'
                : 'content-column hidden'
            }
          >
            <article className="panel">
              <div className="panel-header">
                <h2>{t(locale, 'history')}</h2>
              </div>
              <div className="history-list">
                {weeks.length <= 1 ? <p>{t(locale, 'emptyHistory')}</p> : null}
                {weeks.map((item) => (
                  <button
                    key={item.id}
                    className={item.id === week.id ? 'history-card active' : 'history-card'}
                    onClick={() => void handleWeekSelect(item.id)}
                  >
                    <strong>{item.label}</strong>
                    <span>{item.highlights.join(' • ') || t(locale, 'planner')}</span>
                  </button>
                ))}
              </div>
            </article>
          </section>

          {/* ── Desktop sidebar: shopping list (hidden on mobile) ── */}
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

      {/* ── Modal: Meal editor ── */}
      {editingMeal && editingDraft ? (
        <div className="modal-backdrop">
          <div className="modal-card meal-editor-modal">
            <div className="panel-header">
              <h3>{t(locale, 'edit')}</h3>
              <button
                className="secondary-button icon-button"
                onClick={closeMealEditor}
                aria-label={t(locale, 'close')}
                title={t(locale, 'close')}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="meal-editor-form">
              <input
                value={editingDraft.title ?? ''}
                placeholder={t(locale, 'mealName')}
                onFocus={() => setOpenSuggestionId(editingMeal.id)}
                onChange={(event) => void handleMealFieldChange(editingMeal, 'title', event.target.value)}
              />
              <input
                value={editingDraft.recipeUrl ?? ''}
                placeholder={t(locale, 'recipeUrl')}
                onChange={(event) => void handleMealFieldChange(editingMeal, 'recipeUrl', event.target.value)}
              />
              <textarea
                value={editingDraft.notes ?? ''}
                placeholder={t(locale, 'notes')}
                rows={4}
                onChange={(event) => void handleMealFieldChange(editingMeal, 'notes', event.target.value)}
              />
            </div>
            {openSuggestionId === editingMeal.id && (suggestions[editingMeal.id]?.length ?? 0) > 0 ? (
              <div className="suggestion-list suggestion-list-inline">
                {suggestions[editingMeal.id].map((suggestion) => (
                  <button
                    key={suggestion.id}
                    className="suggestion-item"
                    onMouseDown={() => applySuggestion(editingMeal, suggestion)}
                  >
                    <strong>{suggestion.label}</strong>
                    <span>{suggestion.type === 'recipe' ? t(locale, 'recipes') : t(locale, 'history')}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="modal-actions">
              {editingDraft.recipeUrl ? (
                <a
                  className="link-button icon-button"
                  href={editingDraft.recipeUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={t(locale, 'openRecipe')}
                  title={t(locale, 'openRecipe')}
                >
                  <span aria-hidden="true">↗</span>
                </a>
              ) : null}
              <button className="secondary-button" onClick={closeMealEditor}>
                {t(locale, 'close')}
              </button>
              <button className="primary-button" onClick={() => void handleMealEditorSave(editingMeal)}>
                {t(locale, 'save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Modal: Settings ── */}
      {settingsOpen ? (
        <div className="modal-backdrop" onClick={() => { applyColorDraft(); setSettingsOpen(false) }}>
          <div className="modal-card settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h3>{t(locale, 'settings')}</h3>
              <button
                className="secondary-button icon-button"
                onClick={() => { applyColorDraft(); setSettingsOpen(false) }}
                aria-label={t(locale, 'close')}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="settings-color-grid">
              {(
                [
                  { key: 'color1', label: t(locale, 'colorBase') },
                  { key: 'color2', label: t(locale, 'colorSurface') },
                  { key: 'color3', label: t(locale, 'colorMuted') },
                  { key: 'color4', label: t(locale, 'colorAccent') },
                ] as const
              ).map(({ key, label }) => (
                <div key={key}>
                  <div className="settings-color-row">
                    <label htmlFor={`color-${key}`}>{label}</label>
                    <div
                      className="settings-color-swatch"
                      style={{ background: colorDraft[key] || (theme === 'dark' ? darkColors[key] : lightColors[key]) }}
                    />
                  </div>
                  <input
                    id={`color-${key}`}
                    type="text"
                    value={colorDraft[key]}
                    placeholder={theme === 'dark' ? darkColors[key] : lightColors[key]}
                    onChange={(e) => {
                      const val = e.target.value
                      setColorDraft((prev) => ({ ...prev, [key]: val }))
                      if (/^#[0-9a-fA-F]{3,8}$/.test(val)) {
                        const cssVar = `--color-${key.replace('color', '')}`
                        document.documentElement.style.setProperty(cssVar, val)
                      }
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={resetColors}>
                {t(locale, 'resetColors')}
              </button>
              <button className="primary-button" onClick={() => { applyColorDraft(); setSettingsOpen(false) }}>
                {t(locale, 'save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Modal: Link confirm ── */}
      {linkConfirmMeal ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <p>{t(locale, 'openLinkConfirm')}</p>
            <p><strong>{linkConfirmMeal.title}</strong></p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setLinkConfirmMeal(null)}>
                {t(locale, 'close')}
              </button>
              <a
                className="primary-button"
                href={linkConfirmMeal.recipeUrl ?? ''}
                target="_blank"
                rel="noreferrer"
                onClick={() => setLinkConfirmMeal(null)}
              >
                {t(locale, 'open')}
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Modal: Ingredient picker ── */}
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
              <button className="secondary-button" onClick={() => setIngredientDialog(null)}>
                {t(locale, 'close')}
              </button>
              <button className="primary-button" onClick={() => void handleConfirmIngredients()}>
                {t(locale, 'confirmIngredients')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
