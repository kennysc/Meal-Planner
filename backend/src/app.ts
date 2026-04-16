import cors from 'cors'
import express from 'express'
import { MealStatus, Prisma, ShoppingSection } from '@prisma/client'
import { z } from 'zod'
import { prisma } from './prisma.js'
import { ensureWeek, weekInclude, weekLabel } from './week.js'
import { serializeMealEntry, serializeRecipe, serializeShoppingItem } from './serializers.js'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/weeks/current', async (req, res, next) => {
  try {
    const locale = String(req.query.locale ?? 'fr-CA')
    const week = await ensureWeek()
    res.json({
      week: {
        id: week.id,
        startDate: week.startDate,
        label: weekLabel(week.startDate, locale),
        meals: week.mealEntries.map(serializeMealEntry),
        shoppingList: {
          id: week.shoppingList?.id,
          items: week.shoppingList?.items.map(serializeShoppingItem) ?? [],
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/weeks', async (req, res, next) => {
  try {
    const locale = String(req.query.locale ?? 'fr-CA')
    await ensureWeek()
    const weeks = await prisma.week.findMany({
      include: {
        mealEntries: true,
      },
      orderBy: { startDate: 'desc' },
      take: 12,
    })

    res.json({
      weeks: weeks.map((week) => ({
        id: week.id,
        startDate: week.startDate,
        label: weekLabel(week.startDate, locale),
        highlights: week.mealEntries.filter((entry) => entry.title.trim()).slice(0, 4).map((entry) => entry.title),
      })),
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/weeks/:weekId', async (req, res, next) => {
  try {
    const locale = String(req.query.locale ?? 'fr-CA')
    const week = await prisma.week.findUniqueOrThrow({
      where: { id: req.params.weekId },
      include: weekInclude,
    })

    res.json({
      week: {
        id: week.id,
        startDate: week.startDate,
        label: weekLabel(week.startDate, locale),
        meals: week.mealEntries.map(serializeMealEntry),
        shoppingList: {
          id: week.shoppingList?.id,
          items: week.shoppingList?.items.map(serializeShoppingItem) ?? [],
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/weeks', async (req, res, next) => {
  try {
    const locale = String(req.query.locale ?? 'fr-CA')
    const bodySchema = z.object({
      date: z.string().datetime({ offset: true }).or(z.string().date()),
    })
    const body = bodySchema.parse(req.body)
    const week = await ensureWeek(new Date(body.date))

    res.status(201).json({
      week: {
        id: week.id,
        startDate: week.startDate,
        label: weekLabel(week.startDate, locale),
        meals: week.mealEntries.map(serializeMealEntry),
        shoppingList: {
          id: week.shoppingList?.id,
          items: week.shoppingList?.items.map(serializeShoppingItem) ?? [],
        },
      },
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/weeks/:weekId/copy-previous', async (req, res, next) => {
  try {
    const currentWeek = await prisma.week.findUniqueOrThrow({ where: { id: req.params.weekId } })
    const previousWeek = await prisma.week.findFirst({
      where: { startDate: { lt: currentWeek.startDate } },
      include: { mealEntries: true },
      orderBy: { startDate: 'desc' },
    })

    if (!previousWeek) {
      res.status(404).json({ message: 'Aucune semaine precedente disponible.' })
      return
    }

    await prisma.$transaction(
      previousWeek.mealEntries.map((entry) =>
        prisma.mealEntry.updateMany({
          where: {
            weekId: currentWeek.id,
            dayOfWeek: entry.dayOfWeek,
            mealType: entry.mealType,
          },
          data: {
            title: entry.title,
            notes: entry.notes,
            status: entry.status,
            recipeId: entry.recipeId,
            recipeUrl: entry.recipeUrl,
          },
        }),
      ),
    )

    const week = await prisma.week.findUniqueOrThrow({ where: { id: currentWeek.id }, include: weekInclude })
    res.json({ week: { id: week.id, startDate: week.startDate, meals: week.mealEntries.map(serializeMealEntry) } })
  } catch (error) {
    next(error)
  }
})

app.put('/api/weeks/:weekId/meals/:mealId', async (req, res, next) => {
  try {
    const bodySchema = z.object({
      title: z.string().default(''),
      notes: z.string().default(''),
      status: z.nativeEnum(MealStatus).default(MealStatus.PLANNED),
      recipeId: z.string().cuid().nullable().optional(),
      recipeUrl: z.string().url().nullable().optional().or(z.literal('')),
    })

    const body = bodySchema.parse(req.body)
    const existingMeal = await prisma.mealEntry.findFirstOrThrow({ where: { id: req.params.mealId, weekId: req.params.weekId } })
    const meal = await prisma.mealEntry.update({
      where: { id: existingMeal.id },
      data: {
        title: body.title,
        notes: body.notes,
        status: body.status,
        recipeId: body.recipeId ?? null,
        recipeUrl: body.recipeUrl || null,
      },
      include: {
        recipe: {
          include: {
            recipeTags: { include: { tag: true } },
            recipeIngredients: { include: { ingredient: true }, orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    })

    res.json({ meal: serializeMealEntry(meal) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/weeks/:weekId/meals/:mealId/add-recipe-ingredients', async (req, res, next) => {
  try {
    const bodySchema = z.object({ ingredientIds: z.array(z.string().cuid()).default([]) })
    const body = bodySchema.parse(req.body)

    const meal = await prisma.mealEntry.findFirstOrThrow({
      where: { id: req.params.mealId, weekId: req.params.weekId },
      include: {
        recipe: {
          include: {
            recipeIngredients: { include: { ingredient: true } },
          },
        },
        week: { include: { shoppingList: true } },
      },
    })

    if (!meal.recipe || !meal.week.shoppingList) {
      res.status(400).json({ message: 'Aucune recette associee a ce repas.' })
      return
    }

    const ingredientsToAdd = meal.recipe.recipeIngredients.filter((ingredient) => body.ingredientIds.includes(ingredient.ingredientId))

    for (const ingredient of ingredientsToAdd) {
      const existing = await prisma.shoppingListItem.findFirst({
        where: {
          shoppingListId: meal.week.shoppingList.id,
          ingredientId: ingredient.ingredientId,
          checked: false,
        },
      })

      if (existing) {
        const quantityText = [existing.quantityText, ingredient.quantityText].filter(Boolean).join(' + ')
        await prisma.shoppingListItem.update({
          where: { id: existing.id },
          data: {
            quantityText: quantityText || null,
            sourceRecipeId: meal.recipe.id,
            sourceMealEntryId: meal.id,
          },
        })
        continue
      }

      await prisma.shoppingListItem.create({
        data: {
          shoppingListId: meal.week.shoppingList.id,
          ingredientId: ingredient.ingredientId,
          label: ingredient.ingredient.name,
          quantityText: ingredient.quantityText || null,
          sourceRecipeId: meal.recipe.id,
          sourceMealEntryId: meal.id,
        },
      })
    }

    const shoppingList = await prisma.shoppingList.findUniqueOrThrow({
      where: { id: meal.week.shoppingList.id },
      include: { items: { include: { ingredient: true }, orderBy: [{ checked: 'asc' }, { createdAt: 'asc' }] } },
    })

    res.json({ items: shoppingList.items.map(serializeShoppingItem) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/weeks/:weekId/shopping-list', async (req, res, next) => {
  try {
    const shoppingList = await prisma.shoppingList.findFirstOrThrow({
      where: { weekId: req.params.weekId },
      include: { items: { include: { ingredient: true }, orderBy: [{ checked: 'asc' }, { createdAt: 'asc' }] } },
    })
    res.json({ items: shoppingList.items.map(serializeShoppingItem) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/weeks/:weekId/shopping-list/items', async (req, res, next) => {
  try {
    const bodySchema = z.object({
      label: z.string().min(1),
      quantityText: z.string().optional(),
      section: z.nativeEnum(ShoppingSection).nullable().optional(),
    })
    const body = bodySchema.parse(req.body)
    const shoppingList = await prisma.shoppingList.findFirstOrThrow({ where: { weekId: req.params.weekId } })
    const item = await prisma.shoppingListItem.create({
      data: {
        shoppingListId: shoppingList.id,
        label: body.label,
        quantityText: body.quantityText || null,
        section: body.section ?? null,
      },
    })

    res.status(201).json({ item: serializeShoppingItem(item) })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/shopping-list/items/:itemId', async (req, res, next) => {
  try {
    const bodySchema = z.object({
      checked: z.boolean().optional(),
      label: z.string().min(1).optional(),
      quantityText: z.string().nullable().optional(),
    })

    const body = bodySchema.parse(req.body)
    const item = await prisma.shoppingListItem.update({
      where: { id: req.params.itemId },
      data: {
        checked: body.checked,
        label: body.label,
        quantityText: body.quantityText,
      },
    })

    res.json({ item: serializeShoppingItem(item) })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/shopping-list/items/:itemId', async (req, res, next) => {
  try {
    await prisma.shoppingListItem.delete({ where: { id: req.params.itemId } })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

app.get('/api/tags', async (_req, res, next) => {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } })
    res.json({ tags })
  } catch (error) {
    next(error)
  }
})

app.get('/api/search/meal-suggestions', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim()
    if (!q) {
      res.json({ suggestions: [] })
      return
    }

    const recipes = await prisma.recipe.findMany({
      where: { isArchived: false, name: { contains: q, mode: Prisma.QueryMode.insensitive } },
      include: { recipeTags: { include: { tag: true } } },
      orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
      take: 6,
    })

    const mealHistory = await prisma.mealEntry.findMany({
      where: { title: { contains: q, mode: Prisma.QueryMode.insensitive }, NOT: { title: '' } },
      distinct: ['title'],
      orderBy: { updatedAt: 'desc' },
      take: 6,
    })

    res.json({
      suggestions: [
        ...recipes.map((recipe) => ({
          id: recipe.id,
          label: recipe.name,
          type: 'recipe',
          recipeId: recipe.id,
          recipeUrl: recipe.url,
          tags: recipe.recipeTags.map((recipeTag) => recipeTag.tag.name),
        })),
        ...mealHistory
          .filter((meal) => !recipes.some((recipe) => recipe.name.toLowerCase() === meal.title.toLowerCase()))
          .map((meal) => ({
            id: meal.id,
            label: meal.title,
            type: 'history',
            recipeId: meal.recipeId,
            recipeUrl: meal.recipeUrl,
            tags: [],
          })),
      ],
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/recipes', async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '').trim()
    const tags = String(req.query.tags ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const ingredients = String(req.query.ingredients ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    const ingredientMode = String(req.query.ingredientMode ?? 'any') === 'all' ? 'all' : 'any'

    const andFilters: Prisma.RecipeWhereInput[] = []

    if (search) {
      andFilters.push({ name: { contains: search, mode: Prisma.QueryMode.insensitive } })
    }

    if (tags.length > 0) {
      andFilters.push(
        ...tags.map((tagName) => ({
          recipeTags: {
            some: {
              tag: { name: { contains: tagName, mode: Prisma.QueryMode.insensitive } },
            },
          },
        })),
      )
    }

    if (ingredients.length > 0) {
      if (ingredientMode === 'all') {
        andFilters.push(
          ...ingredients.map((ingredient) => ({
            recipeIngredients: {
              some: { ingredient: { name: { contains: ingredient, mode: Prisma.QueryMode.insensitive } } },
            },
          })),
        )
      } else {
        andFilters.push({
          OR: ingredients.map((ingredient) => ({
            recipeIngredients: {
              some: { ingredient: { name: { contains: ingredient, mode: Prisma.QueryMode.insensitive } } },
            },
          })),
        })
      }
    }

    const where: Prisma.RecipeWhereInput = {
      isArchived: false,
      ...(andFilters.length > 0 ? { AND: andFilters } : {}),
    }

    const recipes = await prisma.recipe.findMany({
      where,
      include: {
        recipeTags: { include: { tag: true } },
        recipeIngredients: { include: { ingredient: true }, orderBy: { sortOrder: 'asc' } },
        mealEntries: true,
      },
      orderBy: [{ isFavorite: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
    })

    res.json({
      recipes: recipes.map((recipe) => ({
        ...serializeRecipe(recipe),
        lastMadeAt: recipe.mealEntries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0]?.updatedAt ?? null,
        usageCount: recipe.mealEntries.length,
      })),
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/recipes', async (req, res, next) => {
  try {
    const bodySchema = z.object({
      name: z.string().min(1),
      url: z.union([z.string().url(), z.literal('')]).optional(),
      notes: z.string().optional(),
      isFavorite: z.boolean().optional(),
      tags: z.array(z.string().min(1)).default([]),
      ingredients: z
        .array(
          z.object({
            name: z.string().min(1),
            quantityText: z.string().optional(),
            isPantryStaple: z.boolean().optional(),
          }),
        )
        .default([]),
    })

    const body = bodySchema.parse(req.body)
    const recipe = await prisma.recipe.create({
      data: {
        name: body.name,
        url: body.url || null,
        notes: body.notes ?? '',
        isFavorite: body.isFavorite ?? false,
        recipeTags: {
          create: await Promise.all(
            body.tags.map(async (tagName) => {
              const tag = await prisma.tag.upsert({ where: { name: tagName }, update: {}, create: { name: tagName } })
              return { tagId: tag.id }
            }),
          ),
        },
        recipeIngredients: {
          create: await Promise.all(
            body.ingredients.map(async (ingredient, index) => {
              const ingredientRecord = await prisma.ingredient.upsert({
                where: { name: ingredient.name },
                update: {},
                create: { name: ingredient.name },
              })
              return {
                ingredientId: ingredientRecord.id,
                quantityText: ingredient.quantityText ?? '',
                sortOrder: index,
                isPantryStaple: ingredient.isPantryStaple ?? false,
              }
            }),
          ),
        },
      },
      include: {
        recipeTags: { include: { tag: true } },
        recipeIngredients: { include: { ingredient: true }, orderBy: { sortOrder: 'asc' } },
      },
    })

    res.status(201).json({ recipe: serializeRecipe(recipe) })
  } catch (error) {
    next(error)
  }
})

app.put('/api/recipes/:recipeId', async (req, res, next) => {
  try {
    const bodySchema = z.object({
      name: z.string().min(1),
      url: z.union([z.string().url(), z.literal('')]).optional(),
      notes: z.string().optional(),
      isFavorite: z.boolean().optional(),
      isArchived: z.boolean().optional(),
      tags: z.array(z.string().min(1)).default([]),
      ingredients: z
        .array(
          z.object({
            name: z.string().min(1),
            quantityText: z.string().optional(),
            isPantryStaple: z.boolean().optional(),
          }),
        )
        .default([]),
    })

    const body = bodySchema.parse(req.body)

    await prisma.recipe.update({
      where: { id: req.params.recipeId },
      data: {
        name: body.name,
        url: body.url || null,
        notes: body.notes ?? '',
        isFavorite: body.isFavorite ?? false,
        isArchived: body.isArchived ?? false,
        recipeTags: { deleteMany: {} },
        recipeIngredients: { deleteMany: {} },
      },
    })

    const recipe = await prisma.recipe.update({
      where: { id: req.params.recipeId },
      data: {
        recipeTags: {
          create: await Promise.all(
            body.tags.map(async (tagName) => {
              const tag = await prisma.tag.upsert({ where: { name: tagName }, update: {}, create: { name: tagName } })
              return { tagId: tag.id }
            }),
          ),
        },
        recipeIngredients: {
          create: await Promise.all(
            body.ingredients.map(async (ingredient, index) => {
              const ingredientRecord = await prisma.ingredient.upsert({
                where: { name: ingredient.name },
                update: {},
                create: { name: ingredient.name },
              })
              return {
                ingredientId: ingredientRecord.id,
                quantityText: ingredient.quantityText ?? '',
                sortOrder: index,
                isPantryStaple: ingredient.isPantryStaple ?? false,
              }
            }),
          ),
        },
      },
      include: {
        recipeTags: { include: { tag: true } },
        recipeIngredients: { include: { ingredient: true }, orderBy: { sortOrder: 'asc' } },
      },
    })

    res.json({ recipe: serializeRecipe(recipe) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/recipes/:recipeId/archive', async (req, res, next) => {
  try {
    const recipe = await prisma.recipe.update({
      where: { id: req.params.recipeId },
      data: { isArchived: true },
      include: { recipeTags: { include: { tag: true } }, recipeIngredients: { include: { ingredient: true } } },
    })
    res.json({ recipe: serializeRecipe(recipe) })
  } catch (error) {
    next(error)
  }
})

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ message: 'Donnees invalides.', issues: error.issues })
    return
  }

  console.error(error)
  res.status(500).json({ message: 'Erreur interne du serveur.' })
})

export { app }
