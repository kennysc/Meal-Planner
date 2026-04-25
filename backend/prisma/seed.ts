import { MealStatus, MealType } from '@prisma/client'
import { prisma } from '../src/prisma.js'
import { ensureWeek } from '../src/week.js'

async function upsertRecipe(data: {
  name: string
  url?: string
  notes?: string
  isFavorite?: boolean
  tags: string[]
  ingredients: Array<{ name: string; quantityText: string; isPantryStaple?: boolean }>
}) {
  const existing = await prisma.recipe.findUnique({ where: { name: data.name } })
  if (existing) {
    return existing
  }

  return prisma.recipe.create({
    data: {
      name: data.name,
      url: data.url,
      notes: data.notes ?? '',
      isFavorite: data.isFavorite ?? false,
      recipeTags: {
        create: await Promise.all(
          data.tags.map(async (tagName) => {
            const tag = await prisma.tag.upsert({ where: { name: tagName }, update: {}, create: { name: tagName } })
            return { tagId: tag.id }
          }),
        ),
      },
      recipeIngredients: {
        create: await Promise.all(
          data.ingredients.map(async (ingredient, index) => {
            const ingredientRecord = await prisma.ingredient.upsert({
              where: { name: ingredient.name },
              update: {},
              create: { name: ingredient.name },
            })
            return {
              ingredientId: ingredientRecord.id,
              quantityText: ingredient.quantityText,
              sortOrder: index,
              isPantryStaple: ingredient.isPantryStaple ?? false,
            }
          }),
        ),
      },
    },
  })
}

async function main() {
  const chili = await upsertRecipe({
    name: 'Chili de semaine',
    url: 'https://www.ricardocuisine.com/',
    notes: 'Bon pour les lunchs du lendemain.',
    isFavorite: true,
    tags: ['Rapide', 'Familial'],
    ingredients: [
      { name: 'Boeuf hache', quantityText: '450 g' },
      { name: 'Haricots rouges', quantityText: '1 conserve' },
      { name: 'Tomates en des', quantityText: '1 conserve' },
      { name: 'Oignon', quantityText: '1' },
      { name: 'Poudre de chili', quantityText: '2 c. a soupe', isPantryStaple: true },
    ],
  })

  const saumon = await upsertRecipe({
    name: 'Saumon a l erable',
    url: 'https://www.troisfoisparjour.com/',
    notes: 'Servir avec riz et brocoli.',
    tags: ['Poisson', 'Souper', 'Rapide'],
    ingredients: [
      { name: 'Saumon', quantityText: '4 filets' },
      { name: 'Sirop d erable', quantityText: '2 c. a soupe' },
      { name: 'Sauce soya', quantityText: '2 c. a soupe', isPantryStaple: true },
      { name: 'Brocoli', quantityText: '1 tete' },
    ],
  })

  const week = await ensureWeek()

  await prisma.mealEntry.updateMany({
    where: { weekId: week.id, dayOfWeek: 'MONDAY', mealType: MealType.DINNER, title: '' },
    data: { title: chili.name, recipeId: chili.id, recipeUrl: chili.url, status: MealStatus.PLANNED },
  })

  await prisma.mealEntry.updateMany({
    where: { weekId: week.id, dayOfWeek: 'TUESDAY', mealType: MealType.SUPPER, title: '' },
    data: { title: saumon.name, recipeId: saumon.id, recipeUrl: saumon.url, status: MealStatus.PLANNED },
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
