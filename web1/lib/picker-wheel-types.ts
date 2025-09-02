// Picker Wheel Types Configuration
export interface PickerWheelType {
  id: string
  title: string
  description: string
  icon: string
  category: string
  defaultItems: string[]
  color: string
  isCustomizable: boolean
  maxItems?: number
  minItems?: number
  hiddenForNewUsers?: boolean // Controls visibility for new organizers and participants
  // Enhanced features for specialized wheel types
  features?: {
    supportsImages?: boolean
    imageRequired?: boolean
    showWinnerImage?: boolean
    allowImageUpload?: boolean
    maxImageSize?: number // in MB
    supportedFormats?: string[]
  }
}

export const PICKER_WHEEL_TYPES: PickerWheelType[] = [
  // Basic Picker Wheels
  {
    id: "basic-picker",
    title: "Picker Wheel",
    description: "Make random decisions from your custom options",
    icon: "🎯",
    category: "personal",
    defaultItems: ["Option 1", "Option 2", "Option 3", "Option 4", "Option 5"],
    color: "#8e0b16",
    isCustomizable: true
  },
  {
    id: "team-picker",
    title: "Team Picker Wheel",
    description: "Generate random teams from a list of names",
    icon: "👥",
    category: "entertainment",
    defaultItems: ["Team Alpha", "Team Beta", "Team Gamma", "Team Delta"],
    color: "#2563eb",
    isCustomizable: true
  },
  {
    id: "yes-no-picker",
    title: "Yes No Picker Wheel",
    description: "Quick yes or no decisions made easy",
    icon: "❓",
    category: "personal",
    defaultItems: ["Yes", "No"],
    color: "#16a34a",
    isCustomizable: false,
    maxItems: 2,
    minItems: 2,
    hiddenForNewUsers: false // Make visible since it's commonly used
  },

  // Number & Letter Wheels
  {
    id: "number-picker",
    title: "Number Picker Wheel",
    description: "Pick random numbers for games, draws, or decisions",
    icon: "🔢",
    category: "academic",
    defaultItems: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    color: "#dc2626",
    isCustomizable: true,
    maxItems: 100,
    hiddenForNewUsers: true
  },

  // Geographic Wheels
  {
    id: "country-picker",
    title: "Country Picker Wheel",
    description: "Explore the world by picking random countries",
    icon: "🌍",
    category: "research",
    defaultItems: ["United States", "Canada", "United Kingdom", "France", "Germany", "Japan", "Australia", "Brazil", "India", "China"],
    color: "#059669",
    isCustomizable: true,
    hiddenForNewUsers: true
  },

  // Visual & Media Wheels
  {
    id: "color-picker",
    title: "Color Picker Wheel",
    description: "Choose random colors for art and design projects",
    icon: "🎨",
    category: "academic",
    defaultItems: ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Brown", "Black", "White"],
    color: "#ea580c",
    isCustomizable: true,
    hiddenForNewUsers: true
  },
  {
    id: "image-picker",
    title: "Image Picker Wheel",
    description: "Upload images for each slice and reveal winner's picture on selection",
    icon: "🖼️",
    category: "entertainment",
    defaultItems: ["Image 1", "Image 2", "Image 3", "Image 4", "Image 5"],
    color: "#be185d",
    isCustomizable: true,
    maxItems: 12,
    minItems: 2,
    hiddenForNewUsers: true,
    // Enhanced image picker features
    features: {
      supportsImages: true,
      imageRequired: false,
      showWinnerImage: true,
      allowImageUpload: true,
      maxImageSize: 5, // MB
      supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
    }
  },

  // Time & Date Wheels
  {
    id: "date-picker",
    title: "Date Picker Wheel",
    description: "Pick random dates or days of the week",
    icon: "📅",
    category: "academic",
    defaultItems: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    color: "#9333ea",
    isCustomizable: true,
    hiddenForNewUsers: true
  },

  // Social Media Wheels
  {
    id: "instagram-comment-picker",
    title: "Instagram Comment Picker Wheel",
    description: "Perfect for Instagram giveaways and contests",
    icon: "📱",
    category: "personal",
    defaultItems: ["@user1", "@user2", "@user3", "@user4", "@user5"],
    color: "#e11d48",
    isCustomizable: true,
    hiddenForNewUsers: true
  },

  // Sports Wheels
  {
    id: "mlb-picker",
    title: "MLB Picker Wheel",
    description: "Pick your favorite Major League Baseball team",
    icon: "⚾",
    category: "entertainment",
    defaultItems: [
      "New York Yankees", "Boston Red Sox", "Los Angeles Dodgers", "San Francisco Giants",
      "Chicago Cubs", "St. Louis Cardinals", "Atlanta Braves", "Philadelphia Phillies",
      "Houston Astros", "Texas Rangers", "Seattle Mariners", "Oakland Athletics"
    ],
    color: "#1e40af",
    isCustomizable: false,
    hiddenForNewUsers: true
  },
  {
    id: "nba-picker",
    title: "NBA Picker Wheel",
    description: "Choose from National Basketball Association teams",
    icon: "🏀",
    category: "entertainment",
    defaultItems: [
      "Los Angeles Lakers", "Boston Celtics", "Golden State Warriors", "Chicago Bulls",
      "Miami Heat", "San Antonio Spurs", "Philadelphia 76ers", "New York Knicks",
      "Brooklyn Nets", "Milwaukee Bucks", "Phoenix Suns", "Dallas Mavericks"
    ],
    color: "#dc2626",
    isCustomizable: false,
    hiddenForNewUsers: true
  },
  {
    id: "nfl-picker",
    title: "NFL Picker Wheel",
    description: "Select from National Football League teams",
    icon: "🏈",
    category: "entertainment",
    defaultItems: [
      "New England Patriots", "Dallas Cowboys", "Green Bay Packers", "Pittsburgh Steelers",
      "San Francisco 49ers", "New York Giants", "Chicago Bears", "Denver Broncos",
      "Kansas City Chiefs", "Seattle Seahawks", "Los Angeles Rams", "Buffalo Bills"
    ],
    color: "#059669",
    isCustomizable: false,
    hiddenForNewUsers: true
  }
]

// Simplified categories per request
export const PICKER_CATEGORIES = [
  { id: "research", name: "Research", icon: "🧪" },
  { id: "academic", name: "Academic", icon: "🎓" },
  { id: "entertainment", name: "Entertainment", icon: "🎬" },
  { id: "personal", name: "Personal", icon: "🏠" }
]

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

// Filter wheels based on user role and admin overrides
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
