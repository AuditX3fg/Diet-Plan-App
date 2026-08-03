import type { FruitOption, HabitId, MealGroup, SportPreference } from './types'

type RawMeal = [id: string, name: string, nameEn: string, calories: number, protein: number, carbs: number, recipeUrl?: string]

const groupStyle = {
  breakfast: { color: '#f2c879', glyph: '🍳' },
  snack: { color: '#b89acb', glyph: '🥣' },
  lunch: { color: '#d28d5d', glyph: '🍗' },
  dinner: { color: '#7da28c', glyph: '🍽️' },
} as const

function makeOptions(group: keyof typeof groupStyle, rows: RawMeal[]) {
  return rows.map(([id, name, nameEn, calories, protein, carbs, recipeUrl]) => ({
    id,
    name,
    nameEn,
    description: 'حصة محسوبة من الخطة الأصلية',
    descriptionEn: 'Portion calculated from the original plan',
    calories,
    protein,
    carbs,
    fat: Math.max(2, Math.round((calories - protein * 4 - carbs * 4) / 9)),
    color: groupStyle[group].color,
    glyph: groupStyle[group].glyph,
    imageKey: id,
    recipeUrl,
  }))
}

export const mealGroups: MealGroup[] = [
  {
    id: 'breakfast', title: 'الفطور', titleEn: 'Breakfast', subtitle: 'بداية مشبعة ليوم متوازن', subtitleEn: 'A satisfying start to a balanced day', time: '٨:٣٠ ص', timeEn: '8:30 AM',
    options: makeOptions('breakfast', [
      ['cottage-pancake', 'بانكيك قريشة', 'Cottage cheese pancakes', 350, 28, 33, 'https://www.instagram.com/reel/CytSYzCqTdE/'],
      ['labneh-toast', 'توست حبوب كاملة مع لبنة', 'Whole-grain toast with labneh', 290, 19, 40],
      ['takwira', 'تقويرة لحمة مدقوقة', 'Ground beef pita', 420, 33, 30, 'https://www.instagram.com/reel/Cy823GvIuvZ/'],
      ['eggs', 'بيض مع خبز حبوب كاملة', 'Eggs with whole-grain bread', 360, 30, 26],
      ['foul', 'فول مدمس مع خبز وخضار', 'Fava beans with pita and vegetables', 400, 25, 33],
      ['turkey-toast', 'توست حبش مدخن وجبنة', 'Smoked turkey and cheese toast', 360, 28, 26],
      ['cottage-honey', 'قريشة مع عسل وفريز', 'Cottage cheese with honey and strawberries', 320, 20, 25],
      ['tiktok-pancake', 'بانكيك عالي البروتين', 'High-protein pancakes', 325, 17, 50],
      ['tiktok-omelette', 'عجة صحية', 'Healthy omelette', 350, 20, 20],
    ]),
  },
  {
    id: 'snack', title: 'وجبة خفيفة', titleEn: 'Snack', subtitle: 'طاقة خفيفة بين الوجبات', subtitleEn: 'A light boost between meals', time: '١١:٣٠ ص', timeEn: '11:30 AM',
    options: makeOptions('snack', [
      ['qatayef', 'قطايف للدايت', 'Diet qatayef', 350, 28, 17],
      ['mafrookeh', 'مفروكة صحية', 'Healthy mafroukeh', 370, 18, 35],
      ['diet-soup', 'شوربة عالية البروتين', 'High-protein soup', 320, 40, 50],
      ['rice-halawa', 'حلاوة الرز', 'Rice pudding', 280, 12, 25],
      ['healthy-dessert', 'تحلية بروتين', 'Protein dessert', 160, 25, 6],
      ['pistachio-cake', 'كيك الفستق', 'Pistachio cake', 300, 17, 27],
      ['protein-bar', 'بروتين بار منزلي', 'Homemade protein bar', 350, 20, 30],
      ['lupin', 'ترمس مسلوق', 'Boiled lupini beans', 280, 25, 30],
      ['french-toast', 'توست فرنسي', 'French toast', 340, 22, 35],
      ['baked-potato', 'بطاطا مشوية', 'Baked potato', 410, 30, 18],
      ['white-cheese', 'جبنة بيضاء مع توست', 'White cheese with whole-grain toast', 370, 42, 30],
      ['falafel', 'فلافل صحية', 'Baked falafel', 320, 12, 40],
      ['milk-oats', 'حليب خالي الدسم مع شوفان', 'Skim milk with oats', 280, 15, 40],
      ['edamame', 'إدامامي مسلوق', 'Boiled edamame', 350, 22, 40],
      ['protein-yogurt', 'زبادي يوناني مع توت', 'Greek yogurt with berries', 300, 18, 15],
      ['healthy-cookies', 'كوكيز صحية', 'Healthy cookies', 300, 18, 30],
      ['cake-pieces', 'قطعتان كيك', 'Two pieces of cake', 350, 20, 35],
      ['pudding', 'مهلبية دايت', 'Diet pudding', 390, 30, 45],
    ]),
  },
  {
    id: 'lunch', title: 'الغداء', titleEn: 'Lunch', subtitle: 'الوجبة الرئيسية لليوم', subtitleEn: 'Your main meal of the day', time: '٣:٠٠ م', timeEn: '3:00 PM',
    options: makeOptions('lunch', [
      ['healthy-burger', 'برغر صحي', 'Healthy burger', 370, 28, 25],
      ['meat-rice', 'لحمة مع رز', 'Beef with rice', 530, 57, 30],
      ['baked-meat', 'لحمة بالفرن مع خبز', 'Oven-baked beef with pita', 520, 42, 48],
      ['red-pasta', 'معكرونة بالصوص الأحمر واللحمة', 'Beef pasta with tomato sauce', 520, 58, 39],
      ['tray-chicken', 'دجاج بالصينية', 'Oven-baked chicken', 450, 46, 30],
      ['healthy-crisp', 'دجاج كريسبي صحي', 'Healthy crispy chicken', 400, 50, 8],
      ['healthy-pasta', 'معكرونة صحية', 'Healthy pasta', 500, 30, 50],
      ['chicken-sandwich', 'ساندويش دجاج', 'Chicken sandwich', 460, 60, 30],
      ['steak-potato', 'ستيك مع بطاطا مشوية', 'Steak or kofta with baked potato', 460, 30, 37],
      ['fajita', 'دجاج فاهيتا', 'Chicken fajita with mozzarella and pita', 550, 47, 25],
      ['tannour-bulgur', 'دجاج وبرغل وخبز تنور', 'Chicken, bulgur and whole-grain pita', 570, 58, 52],
      ['chicken-potato', 'دجاج مع بطاطا', 'Chicken with baked potato', 490, 53, 27],
      ['chicken-rice', 'دجاج مع رز', 'Chicken with rice', 510, 64, 25],
      ['chicken-breast-sandwich', 'ساندويش صدور دجاج', 'Chicken breast sandwich', 420, 57, 30],
      ['healthy-cheesecake', 'تشيز كيك صحي', 'Healthy cheesecake', 480, 40, 38],
      ['tuna-salad', 'سلطة تونا وذرة', 'Tuna and sweetcorn salad', 300, 39, 25],
      ['healthy-lasagna', 'لازانيا صحية', 'Healthy lasagna', 500, 45, 24],
    ]),
  },
  {
    id: 'dinner', title: 'العشاء', titleEn: 'Dinner', subtitle: 'نهاية خفيفة ومشبعة', subtitleEn: 'A light and satisfying finish', time: '٧:٣٠ م', timeEn: '7:30 PM',
    options: makeOptions('dinner', [
      ['escalope', 'اسكالوب', 'Chicken escalope', 500, 38, 33],
      ['sausage-pizza', 'بيتزا سجق', 'Sausage pizza', 450, 40, 30],
      ['rice-chicken-light', 'رز ودجاج خفيف', 'Rice and chicken', 400, 57, 30],
      ['healthy-crepe', 'كريب دجاج دايت', 'Diet chicken crêpe', 420, 51, 30],
      ['healthy-nuggets', 'ناجتس دجاج صحية', 'Healthy chicken nuggets', 400, 28, 35],
      ['tiktok-pizza', 'بيتزا منزلية دايت', 'Homemade diet pizza', 470, 21, 50],
      ['grape-leaves', 'ورق عنب', 'Stuffed grape leaves', 450, 54, 35],
      ['kibbeh-tray', 'كبة بالصينية', 'Baked kibbeh', 590, 36, 55],
      ['stuffed-zucchini', 'كوسا محشي', 'Stuffed zucchini', 500, 56, 40],
      ['tuna-pasta', 'سلطة تونا ومعكرونة', 'Tuna pasta salad', 350, 32, 33],
      ['grilled-fish', 'سمك مشوي مع رز', 'Grilled fish with rice', 480, 38, 48],
      ['shrimp-rice', 'قريدس مع رز', 'Shrimp with rice', 330, 48, 30],
      ['beans-rice', 'خضار ولحمة مع رز', 'Vegetable stew with beef and rice', 430, 22, 45],
      ['mujaddara', 'مجدرة مع لبن', 'Mujaddara with yogurt', 500, 18, 72],
      ['molokhia', 'ملوخية مع دجاج ورز', 'Molokhia with chicken and rice', 560, 60, 38],
      ['sushi', 'عشر حبات سوشي', 'Ten pieces of sushi', 380, 12, 60],
      ['chicken-balls', 'كريات الدجاج', 'Chicken balls', 280, 18, 22],
    ]),
  },
]

export const fruits: FruitOption[] = [
  { id: 'greengage', name: 'برقوق أخضر (جانرك)', nameEn: 'Greengage plum', nameFr: 'Reine-claude', amount: '١٥٠غ', amountEn: '150 g', amountFr: '150 g', calories: 115, glyph: '🍏' },
  { id: 'banana', name: 'موز', nameEn: 'Banana', nameFr: 'Banane', amount: '١٠٠غ', amountEn: '100 g', amountFr: '100 g', calories: 115, glyph: '🍌' },
  { id: 'mango', name: 'مانجو', nameEn: 'Mango', nameFr: 'Mangue', amount: '١٥٠غ', amountEn: '150 g', amountFr: '150 g', calories: 115, glyph: '🥭' },
  { id: 'apple', name: 'تفاح', nameEn: 'Apple', nameFr: 'Pomme', amount: '٢٠٠غ', amountEn: '200 g', amountFr: '200 g', calories: 115, glyph: '🍎' },
  { id: 'papaya', name: 'بابايا', nameEn: 'Papaya', nameFr: 'Papaye', amount: '١٠٠غ', amountEn: '100 g', amountFr: '100 g', calories: 115, glyph: '🥭' },
  { id: 'pineapple', name: 'أناناس', nameEn: 'Pineapple', nameFr: 'Ananas', amount: '٢٠٠غ', amountEn: '200 g', amountFr: '200 g', calories: 115, glyph: '🍍' },
  { id: 'loquat', name: 'أسكدنيا', nameEn: 'Loquat', nameFr: 'Nèfle du Japon', amount: '١٥٠غ', amountEn: '150 g', amountFr: '150 g', calories: 115, glyph: '🍊' },
  { id: 'peach', name: 'دراق', nameEn: 'Peach', nameFr: 'Pêche', amount: '٢٠٠غ', amountEn: '200 g', amountFr: '200 g', calories: 115, glyph: '🍑' },
  { id: 'plum', name: 'برقوق', nameEn: 'Plum', nameFr: 'Prune', amount: '٢٠٠غ', amountEn: '200 g', amountFr: '200 g', calories: 115, glyph: '🫐' },
  { id: 'avocado', name: 'أفوكادو', nameEn: 'Avocado', nameFr: 'Avocat', amount: '٧٠غ', amountEn: '70 g', amountFr: '70 g', calories: 115, glyph: '🥑' },
  { id: 'watermelon', name: 'بطيخ أحمر', nameEn: 'Watermelon', nameFr: 'Pastèque', amount: '٤٠٠غ', amountEn: '400 g', amountFr: '400 g', calories: 115, glyph: '🍉' },
  { id: 'orange', name: 'برتقال', nameEn: 'Orange', nameFr: 'Orange', amount: '٢٠٠غ', amountEn: '200 g', amountFr: '200 g', calories: 115, glyph: '🍊' },
  { id: 'persimmon', name: 'كاكي (خرما)', nameEn: 'Persimmon', nameFr: 'Kaki', amount: '٢٠٠غ', amountEn: '200 g', amountFr: '200 g', calories: 115, glyph: '🍊' },
  { id: 'pear', name: 'إجاص', nameEn: 'Pear', nameFr: 'Poire', amount: '٢٠٠غ', amountEn: '200 g', amountFr: '200 g', calories: 115, glyph: '🍐' },
  { id: 'grapes', name: 'عنب', nameEn: 'Grapes', nameFr: 'Raisin', amount: '١٥٠غ', amountEn: '150 g', amountFr: '150 g', calories: 115, glyph: '🍇' },
  { id: 'berries', name: 'فراولة', nameEn: 'Strawberries', nameFr: 'Fraises', amount: '٤٠٠غ', amountEn: '400 g', amountFr: '400 g', calories: 115, glyph: '🍓' },
  { id: 'custard-apple', name: 'فاكهة القشطة', nameEn: 'Custard apple', nameFr: 'Pomme cannelle', amount: 'حبة متوسطة', amountEn: '1 medium fruit', amountFr: '1 fruit moyen', calories: 115, glyph: '🍈' },
  { id: 'pomegranate', name: 'رمان', nameEn: 'Pomegranate', nameFr: 'Grenade', amount: 'حبة متوسطة', amountEn: '1 medium fruit', amountFr: '1 fruit moyen', calories: 115, glyph: '🍎' },
]

export const habitTasks: Array<{ id: HabitId; label: string; labelEn: string; glyph: string }> = [
  { id: 'meal-1', label: 'الوجبة الأولى', labelEn: 'Breakfast complete', glyph: '🍳' },
  { id: 'meal-2', label: 'الوجبة الثانية', labelEn: 'Snack complete', glyph: '🥣' },
  { id: 'meal-3', label: 'الوجبة الثالثة', labelEn: 'Lunch complete', glyph: '🍗' },
  { id: 'meal-4', label: 'الوجبة الرابعة', labelEn: 'Dinner complete', glyph: '🍽️' },
  { id: 'fruit', label: 'الفواكه', labelEn: 'Fruit target', glyph: '🍎' },
  { id: 'workout', label: 'التمرين', labelEn: 'Workout complete', glyph: '🏋️' },
]

export const sportOptions: Array<{ id: SportPreference; label: string; labelEn: string; glyph: string }> = [
  { id: 'gym', label: 'النادي', labelEn: 'Gym', glyph: '🏋️' },
  { id: 'home', label: 'تمارين منزلية', labelEn: 'Home workout', glyph: '🏠' },
  { id: 'run', label: 'جري', labelEn: 'Running', glyph: '🏃' },
  { id: 'bike', label: 'دراجة', labelEn: 'Cycling', glyph: '🚴' },
  { id: 'swim', label: 'سباحة', labelEn: 'Swimming', glyph: '🏊' },
  { id: 'walk', label: 'مشي', labelEn: 'Walking', glyph: '🚶' },
  { id: 'yoga', label: 'يوغا', labelEn: 'Yoga', glyph: '🧘' },
  { id: 'football', label: 'كرة قدم', labelEn: 'Football', glyph: '⚽' },
]

export const workoutPlans: Record<SportPreference, Array<{ day: string; title: string; detail: string }>> = {
  gym: [
    { day: 'Mon', title: 'Upper body', detail: '45 min · push, pull, core' },
    { day: 'Wed', title: 'Lower body', detail: '45 min · squat, hinge, calves' },
    { day: 'Sat', title: 'Full body', detail: '50 min · controlled strength circuit' },
  ],
  home: [
    { day: 'Mon', title: 'Bodyweight strength', detail: '30 min · 4 rounds' },
    { day: 'Thu', title: 'Mobility + core', detail: '25 min · low impact' },
    { day: 'Sat', title: 'Full body circuit', detail: '35 min · moderate pace' },
  ],
  run: [
    { day: 'Tue', title: 'Easy run', detail: '30 min · conversational pace' },
    { day: 'Thu', title: 'Intervals', detail: '6 × 2 min with recovery' },
    { day: 'Sun', title: 'Long easy run', detail: '45–60 min' },
  ],
  bike: [
    { day: 'Tue', title: 'Cadence ride', detail: '35 min · easy gears' },
    { day: 'Fri', title: 'Tempo ride', detail: '40 min · steady effort' },
    { day: 'Sun', title: 'Endurance ride', detail: '60 min · relaxed pace' },
  ],
  swim: [
    { day: 'Mon', title: 'Technique', detail: '30 min · drills and easy laps' },
    { day: 'Thu', title: 'Intervals', detail: '10 × 50 m with recovery' },
    { day: 'Sat', title: 'Continuous swim', detail: '35 min · relaxed' },
  ],
  walk: [
    { day: 'Daily', title: 'Brisk walk', detail: '35–45 min · 7,000+ steps' },
    { day: 'Sat', title: 'Long walk', detail: '60 min · comfortable pace' },
  ],
  yoga: [
    { day: 'Mon', title: 'Strength flow', detail: '30 min' },
    { day: 'Wed', title: 'Mobility', detail: '25 min' },
    { day: 'Sun', title: 'Recovery flow', detail: '35 min' },
  ],
  football: [
    { day: 'Tue', title: 'Skills + conditioning', detail: '45 min' },
    { day: 'Thu', title: 'Tempo intervals', detail: '30 min' },
    { day: 'Sat', title: 'Match or small-sided game', detail: '60–90 min' },
  ],
}
