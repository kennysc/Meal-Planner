import { Fragment, useEffect, useState } from 'react'
import './App.css'
import {
  addRecipeIngredients,
  addShoppingItem,
  copyPreviousWeek,
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
import { dayLabel, mealLabel, statusLabel, t } from './i18n'
import type { Locale, Meal, MealStatus, Recipe, ShoppingItem, Suggestion, Week, WeekSummary } from './types'

function App() {
  const [locale, setLocale] = useState<Locale>('fr-CA')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    return window.localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
  })
  const [activeTab, setActiveTab] = useState<'planner' | 'recipes' | 'history'>('planner')
  const [week, setWeek] = useState<Week | null>(null)
  const [weeks, setWeeks] = useState<WeekSummary[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [mealDrafts, setMealDrafts] = useState<Record<string, Partial<Meal>>>({})
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion[]>>({})
  const [openSuggestionId, setOpenSuggestionId] = useState<string | null>(null)
  const [editingMealId, setEditingMealId] = useState<string | null>(null)
  const [ingredientDialog, setIngredientDialog] = useState<{ mealId: string; recipe: Recipe } | null>(null)
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<string[]>([])
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

  async function loadDashboard(nextLocale: Locale) {
    setLoading(true)
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
      setSelectedIngredientIds(updatedMeal.recipe.ingredients.filter((ingredient) => !ingredient.isPantryStaple).map((ingredient) => ingredient.ingredientId))
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
    setActiveTab('planner')
  }

  async function handleCopyPreviousWeek() {
    if (!week) return
    const response = await copyPreviousWeek(week.id)
    setWeek((current) =>
      current
        ? {
            ...current,
            meals: response.week.meals,
          }
        : current,
    )
  }

  const groupedMeals = (week?.meals ?? []).reduce<Record<string, Meal[]>>((accumulator, meal) => {
    accumulator[meal.dayOfWeek] = [...(accumulator[meal.dayOfWeek] ?? []), meal]
    return accumulator
  }, {})

  const editingMeal = week?.meals.find((meal) => meal.id === editingMealId) ?? null
  const editingDraft = editingMeal ? mealState(editingMeal) : null

  return (
    <div className="app-shell">
      <header className="hero-card">
        <div className="hero-title-row">
          <h1>{t(locale, 'appTitle')}</h1>
          <div className="week-pill">{week?.label}</div>
        </div>
        <div className="hero-actions">
          <button
            className="theme-toggle icon-button"
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            aria-label={theme === 'light' ? t(locale, 'darkMode') : t(locale, 'lightMode')}
            title={theme === 'light' ? t(locale, 'darkMode') : t(locale, 'lightMode')}
          >
            <span aria-hidden="true">{theme === 'light' ? '◐' : '○'}</span>
          </button>
          <label className="language-picker">
            <span className="sr-only">{t(locale, 'language')}</span>
            <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
              <option value="fr-CA">Francais</option>
              <option value="en-CA">English</option>
            </select>
          </label>
        </div>
      </header>

      <nav className="tab-bar">
        {(['planner', 'recipes', 'history'] as const).map((tab) => (
          <button key={tab} className={activeTab === tab ? 'tab-button active' : 'tab-button'} onClick={() => setActiveTab(tab)}>
            {t(locale, tab)}
          </button>
        ))}
      </nav>

      {loading || !week ? (
        <section className="panel"><p>{t(locale, 'loading')}</p></section>
      ) : (
        <main className="main-layout">
          <section className={activeTab === 'planner' ? 'content-column' : 'content-column hidden'}>
            <article className="panel planner-panel">
              <div className="panel-header">
                <h2>{t(locale, 'planner')}</h2>
                <button
                  className="secondary-button icon-button"
                  onClick={handleCopyPreviousWeek}
                  aria-label={t(locale, 'copyPreviousWeek')}
                  title={t(locale, 'copyPreviousWeek')}
                >
                  <span aria-hidden="true">↺</span>
                </button>
              </div>

              <div className="planner-grid">
                <div className="planner-head planner-corner"></div>
                {(['DINNER', 'SUPPER'] as const).map((mealType) => (
                  <div key={mealType} className="planner-head">
                    {mealLabel(locale, mealType)}
                  </div>
                ))}

                {(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const).map((day) => (
                  <Fragment key={day}>
                    <div key={`${day}-label`} className="planner-day">
                      {dayLabel(locale, day)}
                    </div>
                    {(groupedMeals[day] ?? [])
                      .sort((left, right) => left.mealType.localeCompare(right.mealType))
                      .map((meal) => {
                        const draft = mealState(meal)
                        return (
                          <div key={meal.id} className="meal-card">
                            <div className="meal-summary">
                              <strong>{draft.title?.trim() || t(locale, 'mealName')}</strong>
                              <span className="badge">{statusLabel(locale, draft.status ?? 'PLANNED')}</span>
                            </div>
                            <button className="secondary-button icon-button" onClick={() => openMealEditor(meal.id)} aria-label={t(locale, 'edit')} title={t(locale, 'edit')}>
                              <span aria-hidden="true">✎</span>
                            </button>
                          </div>
                        )
                      })}
                  </Fragment>
                ))}
              </div>
            </article>
          </section>

          <section className={activeTab === 'recipes' ? 'content-column' : 'content-column hidden'}>
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
                <button className="primary-button" onClick={() => void refreshRecipes()}>
                  {t(locale, 'searchRecipes')}
                </button>
              </div>

              <div className="recipe-layout">
                <div className="recipe-form">
                  <h3>{t(locale, 'addRecipe')}</h3>
                  <input value={recipeForm.name} placeholder={t(locale, 'mealName')} onChange={(event) => setRecipeForm((current) => ({ ...current, name: event.target.value }))} />
                  <input value={recipeForm.url} placeholder={t(locale, 'recipeUrl')} onChange={(event) => setRecipeForm((current) => ({ ...current, url: event.target.value }))} />
                  <textarea value={recipeForm.notes} rows={3} placeholder={t(locale, 'notes')} onChange={(event) => setRecipeForm((current) => ({ ...current, notes: event.target.value }))} />
                  <input value={recipeForm.tags} placeholder="Rapide, BBQ, Familial" onChange={(event) => setRecipeForm((current) => ({ ...current, tags: event.target.value }))} />
                  <textarea
                    value={recipeForm.ingredients}
                    rows={5}
                    placeholder={'Poulet|2 poitrines\nRiz|2 tasses'}
                    onChange={(event) => setRecipeForm((current) => ({ ...current, ingredients: event.target.value }))}
                  />
                  <label className="checkbox-row">
                    <input type="checkbox" checked={recipeForm.isFavorite} onChange={(event) => setRecipeForm((current) => ({ ...current, isFavorite: event.target.checked }))} />
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
                        <span>{t(locale, 'lastMade')}: {recipe.lastMadeAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(recipe.lastMadeAt)) : '-'}</span>
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

          <section className={activeTab === 'history' ? 'content-column' : 'content-column hidden'}>
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
              <div className="shopping-entry-row">
                <input value={shoppingDraft} placeholder={t(locale, 'addItem')} onChange={(event) => setShoppingDraft(event.target.value)} />
                 <button className="primary-button icon-button" onClick={() => void handleAddShoppingItem()} aria-label={t(locale, 'add')} title={t(locale, 'add')}>
                   <span aria-hidden="true">+</span>
                 </button>
              </div>
              <div className="shopping-list">
                {week.shoppingList.items.map((item) => (
                  <label key={item.id} className={item.checked ? 'shopping-item checked' : 'shopping-item'}>
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
            </article>
          </aside>
        </main>
      )}

      {editingMeal && editingDraft ? (
        <div className="modal-backdrop">
          <div className="modal-card meal-editor-modal">
            <div className="panel-header">
              <h3>{t(locale, 'edit')}</h3>
              <button className="secondary-button icon-button" onClick={closeMealEditor} aria-label={t(locale, 'close')} title={t(locale, 'close')}>
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
              <select value={editingDraft.status ?? 'PLANNED'} onChange={(event) => void handleMealFieldChange(editingMeal, 'status', event.target.value as MealStatus)}>
                {(['PLANNED', 'MADE', 'SKIPPED'] as const).map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(locale, status)}
                  </option>
                ))}
              </select>
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
                  <button key={suggestion.id} className="suggestion-item" onMouseDown={() => applySuggestion(editingMeal, suggestion)}>
                    <strong>{suggestion.label}</strong>
                    <span>{suggestion.type === 'recipe' ? t(locale, 'recipes') : t(locale, 'history')}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="modal-actions">
              {editingDraft.recipeUrl ? (
                <a className="link-button icon-button" href={editingDraft.recipeUrl} target="_blank" rel="noreferrer" aria-label={t(locale, 'openRecipe')} title={t(locale, 'openRecipe')}>
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
