// lib/wheel-data.ts

export const YES_NO_OPTIONS = ["Yes", "No"]

export const LETTERS_OPTIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))

export const COLORS_OPTIONS = [
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Purple",
  "Orange",
  "Pink",
  "Brown",
  "Black",
  "White",
  "Gray",
  "Cyan",
  "Magenta",
  "Lime",
  "Teal",
  "Indigo",
  "Violet",
  "Gold",
  "Silver",
]

export const MLB_TEAMS = [
  "Arizona Diamondbacks",
  "Atlanta Braves",
  "Baltimore Orioles",
  "Boston Red Sox",
  "Chicago Cubs",
  "Chicago White Sox",
  "Cincinnati Reds",
  "Cleveland Guardians",
  "Colorado Rockies",
  "Detroit Tigers",
  "Houston Astros",
  "Kansas City Royals",
  "Los Angeles Angels",
  "Los Angeles Dodgers",
  "Miami Marlins",
  "Milwaukee Brewers",
  "Minnesota Twins",
  "New York Mets",
  "New York Yankees",
  "Oakland Athletics",
  "Philadelphia Phillies",
  "Pittsburgh Pirates",
  "San Diego Padres",
  "San Francisco Giants",
  "Seattle Mariners",
  "St. Louis Cardinals",
  "Tampa Bay Rays",
  "Texas Rangers",
  "Toronto Blue Jays",
  "Washington Nationals",
]

export const NBA_TEAMS = [
  "Atlanta Hawks",
  "Boston Celtics",
  "Brooklyn Nets",
  "Charlotte Hornets",
  "Chicago Bulls",
  "Cleveland Cavaliers",
  "Dallas Mavericks",
  "Denver Nuggets",
  "Detroit Pistons",
  "Golden State Warriors",
  "Houston Rockets",
  "Indiana Pacers",
  "Los Angeles Clippers",
  "Los Angeles Lakers",
  "Memphis Grizzlies",
  "Miami Heat",
  "Milwaukee Bucks",
  "Minnesota Timberwolves",
  "New Orleans Pelicans",
  "New York Knicks",
  "Oklahoma City Thunder",
  "Orlando Magic",
  "Philadelphia 76ers",
  "Phoenix Suns",
  "Portland Trail Blazers",
  "Sacramento Kings",
  "San Antonio Spurs",
  "Toronto Raptors",
  "Utah Jazz",
  "Washington Wizards",
]

export const NFL_TEAMS = [
  "Arizona Cardinals",
  "Atlanta Falcons",
  "Baltimore Ravens",
  "Buffalo Bills",
  "Carolina Panthers",
  "Chicago Bears",
  "Cincinnati Bengals",
  "Cleveland Browns",
  "Dallas Cowboys",
  "Denver Broncos",
  "Detroit Lions",
  "Green Bay Packers",
  "Houston Texans",
  "Indianapolis Colts",
  "Jacksonville Jaguars",
  "Kansas City Chiefs",
  "Las Vegas Raiders",
  "Los Angeles Chargers",
  "Los Angeles Rams",
  "Miami Dolphins",
  "Minnesota Vikings",
  "New England Patriots",
  "New Orleans Saints",
  "New York Giants",
  "New York Jets",
  "Philadelphia Eagles",
  "Pittsburgh Steelers",
  "San Francisco 49ers",
  "Seattle Seahawks",
  "Tampa Bay Buccaneers",
  "Tennessee Titans",
  "Washington Commanders",
]

export const COUNTRIES_OPTIONS = [
  "USA",
  "Canada",
  "UK",
  "Germany",
  "France",
  "Japan",
  "China",
  "India",
  "Brazil",
  "Australia",
]

export const STATES_OPTIONS = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
]

export const THEMES = [
  {
    value: "default",
    label: "Default (Dynamic HSL)",
    colors: [], // Will use dynamic HSL
  },
  {
    value: "swu-red-white",
    label: "SWU Red & White",
    colors: ["#A00000", "#FFFFFF"], // Red and White from logo
  },
  {
    value: "vibrant",
    label: "Vibrant",
    colors: ["#FF6B6B", "#4ECDC4", "#45B7D1", "#F7B731", "#A23B72"],
  },
  {
    value: "ocean",
    label: "Ocean Blues",
    colors: ["#0077B6", "#0096C7", "#00B4D8", "#48CAE4", "#90E0EF"],
  },
  {
    value: "forest",
    label: "Forest Greens",
    colors: ["#2D6A4F", "#40916C", "#52B788", "#74C69D", "#95D5B2"],
  },
  {
    value: "sunset",
    label: "Sunset Hues",
    colors: ["#FF5733", "#FF8D1A", "#FFC300", "#DAF7A6", "#C70039"],
  },
  {
    value: "grayscale",
    label: "Grayscale",
    colors: ["#333333", "#666666", "#999999", "#CCCCCC", "#EEEEEE"],
  },
  {
    value: "pastel",
    label: "Pastel",
    colors: ["#FFD1DC", "#FFECB3", "#B3E0FF", "#D1FFD1", "#E0B3FF"],
  },
  {
    value: "earthy",
    label: "Earthy Tones",
    colors: ["#8B4513", "#A0522D", "#D2B48C", "#F5DEB3", "#BC8F8F"],
  },
]

export function generateNumberRange(min: number, max: number): string[] {
  if (min > max) return []
  const numbers: string[] = []
  for (let i = min; i <= max; i++) {
    numbers.push(i.toString())
  }
  return numbers
}

export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const currentDate = new Date(startDate)
  const end = new Date(endDate)

  if (isNaN(currentDate.getTime()) || isNaN(end.getTime()) || currentDate > end) {
    return []
  }

  while (currentDate <= end) {
    dates.push(currentDate.toISOString().split("T")[0]) // YYYY-MM-DD
    currentDate.setDate(currentDate.getDate() + 1)
  }
  return dates
}
