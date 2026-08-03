export interface TrainingDayDefinition {
  id: 'day-1' | 'day-2' | 'day-3' | 'day-4' | 'abs'
  title: string
  titleAr: string
  focus: string
  focusAr: string
}

export const ALI_SAADE_USERNAME = 'alisaade'
const assignedTrainingUsernames = new Set([ALI_SAADE_USERNAME, 'khalil', '7made'])

export const aliTrainingDays: TrainingDayDefinition[] = [
  { id: 'day-1', title: 'Day 1', titleAr: 'اليوم الأول', focus: 'Chest & triceps', focusAr: 'الصدر والترايسبس' },
  { id: 'day-2', title: 'Day 2', titleAr: 'اليوم الثاني', focus: 'Legs', focusAr: 'الأرجل' },
  { id: 'day-3', title: 'Day 3', titleAr: 'اليوم الثالث', focus: 'Back & traps', focusAr: 'الظهر والترابيس' },
  { id: 'day-4', title: 'Day 4', titleAr: 'اليوم الرابع', focus: 'Shoulders, arms & back', focusAr: 'الأكتاف والذراعان والظهر' },
  { id: 'abs', title: 'ABS', titleAr: 'البطن', focus: 'Core finisher', focusAr: 'ختام عضلات البطن' },
]

export function isAliSaadeAccount(username: string) {
  return username.trim().toLowerCase() === ALI_SAADE_USERNAME
}

export function hasAssignedTrainingLibrary(username: string) {
  return assignedTrainingUsernames.has(username.trim().toLowerCase())
}
