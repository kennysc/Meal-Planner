import { DayOfWeek, MealType } from '@prisma/client'

export const orderedDays: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
]

export const orderedMeals: MealType[] = [MealType.DINNER, MealType.SUPPER]
