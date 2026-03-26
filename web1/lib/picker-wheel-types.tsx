export interface PickerWheelType {
  id: string
  title: string
  description: string
  icon: string
  category: string
  color: string
  isCustomizable: boolean
  defaultItems: string[]
  maxItems?: number
  hiddenForNewUsers?: boolean // Controls visibility for new organizers and participants
}

// Static wheel types for fallback
export const STATIC_PICKER_WHEEL_TYPES: PickerWheelType[] = [
  {
    id: "team-picker",
    title: "Team Picker Wheel",
    description: "Generate random teams from a list of names",
    icon: "👥",
    category: "entertainment",
    color: "#2563eb",
    isCustomizable: true,
    defaultItems: ["Team Alpha", "Team Beta", "Team Gamma", "Team Delta"]
  },
  {
    id: "yes-no-picker",
    title: "Yes No Picker Wheel",
    description: "Quick yes or no decisions made easy",
    icon: "❓",
    category: "personal",
    color: "#16a34a",
    isCustomizable: false,
    defaultItems: ["Yes", "No"],
    maxItems: 2
  },
  {
    id: "number-picker",
    title: "Number Picker Wheel",
    description: "Pick random numbers for games, draws, or decisions",
    icon: "🔢",
    category: "academic",
    color: "#dc2626",
    isCustomizable: true,
    defaultItems: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    maxItems: 100
  },
  {
    id: "letter-picker",
    title: "Letter Picker Wheel",
    description: "Generate random letters from the alphabet",
    icon: "🔤",
    category: "academic",
    color: "#7c3aed",
    isCustomizable: true,
    defaultItems: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"],
    maxItems: 26
  },
  {
    id: "country-picker",
    title: "Country Picker Wheel",
    description: "Explore the world by picking random countries",
    icon: "🌍",
    category: "research",
    color: "#059669",
    isCustomizable: true,
    defaultItems: ["United States", "Canada", "United Kingdom", "France", "Germany", "Japan", "Australia", "Brazil", "India", "China"]
  },
  {
    id: "color-picker",
    title: "Color Picker Wheel",
    description: "Choose random colors for art and design projects",
    icon: "🎨",
    category: "academic",
    color: "#ea580c",
    isCustomizable: true,
    defaultItems: ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Brown", "Black", "White"]
  },
  {
    id: "image-picker",
    title: "Image Picker Wheel",
    description: "Select random images from your collection",
    icon: "🖼️",
    category: "entertainment",
    color: "#be185d",
    isCustomizable: true,
    defaultItems: ["Image 1", "Image 2", "Image 3", "Image 4", "Image 5"]
  },
  {
    id: "date-picker",
    title: "Date Picker Wheel",
    description: "Pick random dates or days of the week",
    icon: "📅",
    category: "academic",
    color: "#9333ea",
    isCustomizable: true,
    defaultItems: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  },
  {
    id: "instagram-comment-picker",
    title: "Instagram Comment Picker Wheel",
    description: "Perfect for Instagram giveaways and contests",
    icon: "📱",
    category: "personal",
    color: "#e11d48",
    isCustomizable: true,
    defaultItems: ["@user1", "@user2", "@user3", "@user4", "@user5"]
  },
  {
    id: "mlb-picker",
    title: "MLB Picker Wheel",
    description: "Pick your favorite Major League Baseball team",
    icon: "⚾",
    category: "entertainment",
    color: "#1e40af",
    isCustomizable: false,
    defaultItems: [
      "New York Yankees", "Boston Red Sox", "Los Angeles Dodgers", "San Francisco Giants",
      "Chicago Cubs", "St. Louis Cardinals", "Atlanta Braves", "Philadelphia Phillies",
      "Houston Astros", "Texas Rangers", "Seattle Mariners", "Oakland Athletics"
    ]
  },
  {
    id: "nba-picker",
    title: "NBA Picker Wheel",
    description: "Choose from National Basketball Association teams",
    icon: "🏀",
    category: "entertainment",
    color: "#dc2626",
    isCustomizable: false,
    defaultItems: [
      "Los Angeles Lakers", "Boston Celtics", "Golden State Warriors", "Chicago Bulls",
      "Miami Heat", "San Antonio Spurs", "Philadelphia 76ers", "New York Knicks",
      "Brooklyn Nets", "Milwaukee Bucks", "Phoenix Suns", "Dallas Mavericks"
    ]
  },
  {
    id: "nfl-picker",
    title: "NFL Picker Wheel",
    description: "Select from National Football League teams",
    icon: "🏈",
    category: "entertainment",
    color: "#059669",
    isCustomizable: false,
    defaultItems: [
      "New England Patriots", "Dallas Cowboys", "Green Bay Packers", "Pittsburgh Steelers",
      "San Francisco 49ers", "New York Giants", "Chicago Bears", "Denver Broncos",
      "Kansas City Chiefs", "Seattle Seahawks", "Los Angeles Rams", "Buffalo Bills"
    ]
  }
]

// Simplified categories per request
export const PICKER_CATEGORIES = [
  { id: "research", name: "Research", icon: "🧪" },
  { id: "academic", name: "Academic", icon: "🎓" },
  { id: "entertainment", name: "Entertainment", icon: "🎬" },
  { id: "personal", name: "Personal", icon: "🏠" }
]

// Export the main array with the expected name for compatibility
export const PICKER_WHEEL_TYPES = STATIC_PICKER_WHEEL_TYPES

// Generate number range for number picker
export const generateNumberRange = (start: number, end: number): string[] => {
  const numbers: string[] = []
  for (let i = start; i <= end; i++) {
    numbers.push(i.toString())
  }
  return numbers
}

// Generate date range for date picker
export const generateDateRange = (startDate: Date, endDate: Date): string[] => {
  const dates: string[] = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    dates.push(currentDate.toLocaleDateString())
    currentDate.setDate(currentDate.getDate() + 1)
  }

  return dates
}

// Helper functions
export const getPickerWheelById = (id: string): PickerWheelType | undefined => {
  return PICKER_WHEEL_TYPES.find(wheel => wheel.id === id)
}

export const getPickerWheelsByCategory = (category: string): PickerWheelType[] => {
  return PICKER_WHEEL_TYPES.filter(wheel => wheel.category === category)
}

export const getAllPickerWheels = (): PickerWheelType[] => {
  return PICKER_WHEEL_TYPES
}

// Helper function to get visible wheel types based on user role
export const getVisiblePickerWheels = (
  userRole: string,
  adminOverrides?: Set<string>
): PickerWheelType[] => {
  return PICKER_WHEEL_TYPES.filter(wheel => {
    // Admin role: can see all wheels
    if (userRole === 'admin') {
      return true
    }

    // If wheel is not hidden for new users, show it
    if (!wheel.hiddenForNewUsers) {
      return true
    }

    // If admin has overridden visibility for this wheel, show it
    if (adminOverrides && adminOverrides.has(wheel.id)) {
      return true
    }

    // Hide the wheel for new organizers and participants
    return false
  })
}