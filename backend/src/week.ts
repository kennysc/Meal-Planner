import { MealStatus, Prisma } from '@prisma/client'
import { orderedDays, orderedMeals } from './constants.js'
import { prisma } from './prisma.js'

function getWeekStart(date = new Date()) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = utcDate.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  utcDate.setUTCDate(utcDate.getUTCDate() + diff)
  utcDate.setUTCHours(0, 0, 0, 0)
  return utcDate
}

export async function ensureWeek(date = new Date()) {
  const startDate = getWeekStart(date)

  const week = await prisma.week.upsert({
    where: { startDate },
    update: {},
    create: {
      startDate,
      mealEntries: {
        create: orderedDays.flatMap((dayOfWeek) =>
          orderedMeals.map((mealType) => ({
            dayOfWeek,
            mealType,
            title: '',
            notes: '',
            status: MealStatus.PLANNED,
          })),
        ),
      },
      shoppingList: {
        create: {},
      },
    },
    include: {
      mealEntries: true,
      shoppingList: {
        include: {
          items: true,
        },
      },
    },
  })

  const existingSlots = new Set(week.mealEntries.map((entry) => `${entry.dayOfWeek}:${entry.mealType}`))
  const missingEntries = orderedDays.flatMap((dayOfWeek) =>
    orderedMeals
      .filter((mealType) => !existingSlots.has(`${dayOfWeek}:${mealType}`))
      .map((mealType) => ({ weekId: week.id, dayOfWeek, mealType, title: '', notes: '', status: MealStatus.PLANNED })),
  )

  await prisma.$transaction([
    ...(missingEntries.length > 0 ? [prisma.mealEntry.createMany({ data: missingEntries, skipDuplicates: true })] : []),
    prisma.shoppingList.upsert({ where: { weekId: week.id }, update: {}, create: { weekId: week.id } }),
  ])

  return prisma.week.findUniqueOrThrow({
    where: { id: week.id },
    include: weekInclude,
  })
}

export const weekInclude = {
  mealEntries: {
    orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }],
    include: {
      recipe: {
        include: {
          recipeTags: { include: { tag: true } },
          recipeIngredients: { include: { ingredient: true }, orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  },
  shoppingList: {
    include: {
      items: {
        include: {
          ingredient: true,
        },
        orderBy: [{ checked: 'asc' }, { createdAt: 'asc' }],
      },
    },
  },
} satisfies Prisma.WeekInclude

export function weekLabel(startDate: Date, locale: string) {
  const end = new Date(startDate)
  end.setUTCDate(end.getUTCDate() + 6)

  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
  })

  return `${formatter.format(startDate)} - ${formatter.format(end)}`
}
