"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, getDocs, query, where, onSnapshot, orderBy } from "firebase/firestore"
import { Plus, Sparkles, Users, UserCheck, Target } from "lucide-react"

interface WheelTypePreset {
  value: string
  label: string
  description: string
  category: string
  icon: string
  allowedRoles: string[]
  isActivityWheel: boolean
  canBeShared: boolean
  defaultItems?: string[] // Default input text for the wheel
  defaultSettings: {
    allowRealTimeCollection: boolean
    maxParticipants?: number
    requiresApproval: boolean
    congratsMessage?: string
  }
}

const WHEEL_TYPE_PRESETS: WheelTypePreset[] = [
  // Educational Wheels
  {
    value: "student-selector",
    label: "Student Selector",
    description: "Randomly select students for questions, presentations, or activities",
    category: "Educational",
    icon: "🎓",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultItems: ["Student 1", "Student 2", "Student 3", "Student 4", "Student 5", "Student 6"],
    defaultSettings: {
      allowRealTimeCollection: true,
      maxParticipants: 50,
      requiresApproval: false,
      congratsMessage: "🎓 Congratulations, {winner}! You've been selected!"
    }
  },
  {
    value: "topic-picker",
    label: "Topic Picker",
    description: "Select random topics for discussions, essays, or research projects",
    category: "Educational",
    icon: "📚",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultItems: ["Climate Change", "Technology Impact", "Social Media", "Education Reform", "Space Exploration", "Art & Culture"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "quiz-question",
    label: "Quiz Question Selector",
    description: "Randomly select quiz questions for interactive learning",
    category: "Educational",
    icon: "❓",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultItems: ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5", "Bonus Question"],
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false
    }
  },

  // Activity Wheels
  {
    value: "icebreaker",
    label: "Icebreaker Activities",
    description: "Fun icebreaker activities to start classes or meetings",
    category: "Activities",
    icon: "🧊",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultItems: ["Two Truths & a Lie", "Human Bingo", "Name Game", "This or That", "Show & Tell", "Quick Draw"],
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false,
      congratsMessage: "🎉 Great choice, {winner}! Let's get started!"
    }
  },
  {
    value: "brain-break",
    label: "Brain Break Activities",
    description: "Quick energizing activities for classroom breaks",
    category: "Activities",
    icon: "🧠",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultItems: ["Stretch Break", "Dance Party", "Deep Breathing", "Quick Walk", "Desk Yoga", "Mindful Moment"],
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false
    }
  },
  {
    value: "reward-picker",
    label: "Reward Picker",
    description: "Select rewards for good behavior or achievements",
    category: "Activities",
    icon: "🏆",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: false,
    defaultItems: ["Extra Credit", "Homework Pass", "Line Leader", "Computer Time", "Free Choice", "Special Helper"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: true,
      congratsMessage: "🏆 Congratulations, {winner}! You've earned this reward!"
    }
  },

  // Decision Making
  {
    value: "yes-no-maybe",
    label: "Yes/No/Maybe Decider",
    description: "Three-option decision maker for quick choices",
    category: "Decision",
    icon: "🤔",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["Yes", "No", "Maybe"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "priority-picker",
    label: "Priority Picker",
    description: "Help prioritize tasks or activities",
    category: "Decision",
    icon: "📋",
    allowedRoles: ["organizer"],
    isActivityWheel: false,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },

  // Games & Fun
  {
    value: "truth-dare",
    label: "Truth or Dare",
    description: "Classic truth or dare game for social activities",
    category: "Games",
    icon: "🎭",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: true
    }
  },
  {
    value: "would-you-rather",
    label: "Would You Rather",
    description: "Thought-provoking would you rather questions",
    category: "Games",
    icon: "🤷",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false
    }
  },
  {
    value: "random-challenge",
    label: "Random Challenge",
    description: "Fun challenges and dares for group activities",
    category: "Games",
    icon: "⚡",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: true
    }
  },

  // Subject-Specific
  {
    value: "math-operation",
    label: "Math Operation Picker",
    description: "Select random math operations for practice",
    category: "Math",
    icon: "🔢",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "science-experiment",
    label: "Science Experiment Selector",
    description: "Choose random science experiments or demonstrations",
    category: "Science",
    icon: "🔬",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: true
    }
  },
  {
    value: "writing-prompt",
    label: "Writing Prompt Generator",
    description: "Creative writing prompts for language arts",
    category: "Language Arts",
    icon: "✍️",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },

  // Special Events
  {
    value: "holiday-activity",
    label: "Holiday Activities",
    description: "Seasonal and holiday-themed activities",
    category: "Special Events",
    icon: "🎉",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false
    }
  },
  {
    value: "field-trip-vote",
    label: "Field Trip Voting",
    description: "Vote on field trip destinations or activities",
    category: "Special Events",
    icon: "🚌",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      maxParticipants: 200,
      requiresApproval: true
    }
  },

  // Additional Educational Wheels
  {
    value: "reading-level",
    label: "Reading Level Selector",
    description: "Select appropriate reading levels for differentiated instruction",
    category: "Educational",
    icon: "📖",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "presentation-order",
    label: "Presentation Order",
    description: "Randomize the order of student presentations",
    category: "Educational",
    icon: "🎤",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      maxParticipants: 30,
      requiresApproval: false
    }
  },
  {
    value: "learning-station",
    label: "Learning Station Rotation",
    description: "Assign students to different learning stations",
    category: "Educational",
    icon: "🔄",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      maxParticipants: 40,
      requiresApproval: false
    }
  },

  // More Activity Wheels
  {
    value: "morning-greeting",
    label: "Morning Greeting Styles",
    description: "Different ways to greet students each morning",
    category: "Activities",
    icon: "🌅",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "movement-break",
    label: "Movement Break Activities",
    description: "Physical activities to get students moving",
    category: "Activities",
    icon: "🏃",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false
    }
  },
  {
    value: "classroom-job",
    label: "Classroom Job Assignments",
    description: "Assign daily classroom responsibilities to students",
    category: "Activities",
    icon: "👷",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: false,
    defaultSettings: {
      allowRealTimeCollection: false,
      maxParticipants: 30,
      requiresApproval: false
    }
  },

  // More Decision Making
  {
    value: "snack-picker",
    label: "Snack Time Picker",
    description: "Choose healthy snacks for classroom parties",
    category: "Decision",
    icon: "🍎",
    allowedRoles: ["organizer"],
    isActivityWheel: false,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: true
    }
  },
  {
    value: "music-selector",
    label: "Background Music Selector",
    description: "Choose appropriate background music for activities",
    category: "Decision",
    icon: "🎵",
    allowedRoles: ["organizer"],
    isActivityWheel: false,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "seating-arrangement",
    label: "Seating Arrangement",
    description: "Randomly assign student seating arrangements",
    category: "Decision",
    icon: "🪑",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: false,
    defaultSettings: {
      allowRealTimeCollection: false,
      maxParticipants: 35,
      requiresApproval: false
    }
  },

  // Additional Games & Fun
  {
    value: "charades-topics",
    label: "Charades Topic Generator",
    description: "Random topics and themes for charades games",
    category: "Games",
    icon: "🎭",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false
    }
  },
  {
    value: "riddle-selector",
    label: "Riddle & Puzzle Selector",
    description: "Brain teasers and riddles for critical thinking",
    category: "Games",
    icon: "🧩",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "trivia-category",
    label: "Trivia Category Selector",
    description: "Choose trivia categories for quiz games",
    category: "Games",
    icon: "🧠",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false
    }
  },

  // More Subject-Specific
  {
    value: "art-technique",
    label: "Art Technique Explorer",
    description: "Discover different art techniques and mediums",
    category: "Art",
    icon: "🎨",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "history-timeline",
    label: "Historical Period Selector",
    description: "Explore different historical periods and events",
    category: "History",
    icon: "🏛️",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "geography-explorer",
    label: "Geography Explorer",
    description: "Discover countries, capitals, and geographical features",
    category: "Geography",
    icon: "🌍",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "pe-activity",
    label: "PE Activity Selector",
    description: "Choose physical education activities and sports",
    category: "Physical Education",
    icon: "⚽",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false
    }
  },
  {
    value: "vocabulary-builder",
    label: "Vocabulary Word Selector",
    description: "Practice vocabulary words by difficulty level",
    category: "Language Arts",
    icon: "📝",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },

  // Technology & Innovation
  {
    value: "coding-challenge",
    label: "Coding Challenge Selector",
    description: "Programming exercises and coding challenges",
    category: "Technology",
    icon: "💻",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "tech-tool",
    label: "Educational Tech Tool",
    description: "Explore different educational technology tools",
    category: "Technology",
    icon: "🔧",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: true
    }
  },

  // Social-Emotional Learning
  {
    value: "emotion-check",
    label: "Emotion Check-in",
    description: "Help students identify and express their emotions",
    category: "Social-Emotional",
    icon: "😊",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      requiresApproval: false
    }
  },
  {
    value: "kindness-activity",
    label: "Random Acts of Kindness",
    description: "Promote kindness with random acts of kindness activities",
    category: "Social-Emotional",
    icon: "💝",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },

  // Additional Special Events
  {
    value: "spirit-week",
    label: "Spirit Week Activities",
    description: "Fun themed activities for school spirit week",
    category: "Special Events",
    icon: "🎊",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: true,
      maxParticipants: 500,
      requiresApproval: false
    }
  },
  {
    value: "career-exploration",
    label: "Career Exploration",
    description: "Explore different careers and professions",
    category: "Special Events",
    icon: "👩‍💼",
    allowedRoles: ["organizer"],
    isActivityWheel: true,
    canBeShared: true,
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },

  // Picker Wheels (Hidden by Default - Admin Can Activate)
  {
    value: "yes-no-picker",
    label: "Yes No Picker Wheel",
    description: "Quick yes or no decisions made easy",
    category: "Picker Wheels",
    icon: "❓",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["Yes", "No"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "number-picker",
    label: "Number Picker Wheel",
    description: "Pick random numbers for games, draws, or decisions",
    category: "Picker Wheels",
    icon: "🔢",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "country-picker",
    label: "Country Picker Wheel",
    description: "Explore the world by picking random countries",
    category: "Picker Wheels",
    icon: "🌍",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["United States", "Canada", "United Kingdom", "France", "Germany", "Japan", "Australia", "Brazil", "India", "China"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "color-picker",
    label: "Color Picker Wheel",
    description: "Choose random colors for art and design projects",
    category: "Picker Wheels",
    icon: "🎨",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Brown", "Black", "White"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "image-picker",
    label: "Image Picker Wheel",
    description: "Upload images for each slice and reveal winner's picture",
    category: "Picker Wheels",
    icon: "🖼️",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["Image 1", "Image 2", "Image 3", "Image 4", "Image 5"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "date-picker",
    label: "Date Picker Wheel",
    description: "Pick random dates or days of the week",
    category: "Picker Wheels",
    icon: "📅",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "instagram-comment-picker",
    label: "Instagram Comment Picker Wheel",
    description: "Perfect for Instagram giveaways and contests",
    category: "Picker Wheels",
    icon: "📱",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["@user1", "@user2", "@user3", "@user4", "@user5"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "mlb-picker",
    label: "MLB Picker Wheel",
    description: "Pick your favorite Major League Baseball team",
    category: "Picker Wheels",
    icon: "⚾",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["New York Yankees", "Boston Red Sox", "Los Angeles Dodgers", "San Francisco Giants", "Chicago Cubs", "St. Louis Cardinals", "Atlanta Braves", "Philadelphia Phillies", "Houston Astros", "Texas Rangers", "Seattle Mariners", "Oakland Athletics"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "nba-picker",
    label: "NBA Picker Wheel",
    description: "Choose from National Basketball Association teams",
    category: "Picker Wheels",
    icon: "🏀",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["Los Angeles Lakers", "Boston Celtics", "Golden State Warriors", "Chicago Bulls", "Miami Heat", "San Antonio Spurs", "Philadelphia 76ers", "New York Knicks", "Brooklyn Nets", "Milwaukee Bucks", "Phoenix Suns", "Dallas Mavericks"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  },
  {
    value: "nfl-picker",
    label: "NFL Picker Wheel",
    description: "Select from National Football League teams",
    category: "Picker Wheels",
    icon: "🏈",
    allowedRoles: ["organizer", "participant"],
    isActivityWheel: false,
    canBeShared: true,
    defaultItems: ["New England Patriots", "Dallas Cowboys", "Green Bay Packers", "Pittsburgh Steelers", "San Francisco 49ers", "New York Giants", "Chicago Bears", "Denver Broncos", "Kansas City Chiefs", "Seattle Seahawks", "Los Angeles Rams", "Buffalo Bills"],
    defaultSettings: {
      allowRealTimeCollection: false,
      requiresApproval: false
    }
  }
]

interface WheelTypePresetsProps {
  onPresetAdded?: () => void
}

export function WheelTypePresets({ onPresetAdded }: WheelTypePresetsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [addingPreset, setAddingPreset] = useState<string | null>(null)
  const [selectedPreset, setSelectedPreset] = useState<WheelTypePreset | null>(null)
  const [targetSelectionOpen, setTargetSelectionOpen] = useState(false)
  const [distributionTarget, setDistributionTarget] = useState<"all" | "participants" | "organizers" | "specific">("all")
  const [specificUserEmails, setSpecificUserEmails] = useState("")
  const [customMessage, setCustomMessage] = useState("")
  const [existingWheelTypes, setExistingWheelTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const addPresetToDatabase = async (preset: WheelTypePreset) => {
    setAddingPreset(preset.value)
    try {
      const docRef = await addDoc(collection(db, "wheelTypes"), {
        value: preset.value,
        label: preset.label,
        description: preset.description,
        enabled: true,
        order: Date.now(), // Use timestamp for order
        allowedRoles: preset.allowedRoles,
        isActivityWheel: preset.isActivityWheel,
        canBeShared: preset.canBeShared,
        defaultItems: preset.defaultItems || ["Option 1", "Option 2", "Option 3", "Option 4"],
        defaultSettings: preset.defaultSettings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPreset: true,
        category: preset.category,
        icon: preset.icon
      })

      // Broadcast the change to all users
      await addDoc(collection(db, "systemNotifications"), {
        type: "wheelTypeAdded",
        wheelTypeId: docRef.id,
        wheelTypeLabel: preset.label,
        message: `New wheel type "${preset.label}" is now available!`,
        createdAt: serverTimestamp(),
        isActive: true,
        targetRoles: preset.allowedRoles,
        priority: "normal"
      })

      toast({
        title: "✨ Wheel Type Added!",
        description: `${preset.label} has been added and is now available to users.`,
      })

      onPresetAdded?.()
    } catch (error: any) {
      console.error("Error adding preset:", error)
      toast({
        title: "Error Adding Wheel Type",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setAddingPreset(null)
    }
  }

  // Load existing wheel types to filter out already added presets
  useEffect(() => {
    const q = query(collection(db, "wheelTypes"), orderBy("order", "asc"))
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const existingValues = querySnapshot.docs.map(doc => doc.data().value)
      setExistingWheelTypes(existingValues)
      setLoading(false)
    }, (error) => {
      console.error("Error loading existing wheel types:", error)
      setLoading(false)
    })
    
    return () => unsubscribe()
  }, [])

  // Filter out presets that are already added
  const availablePresets = WHEEL_TYPE_PRESETS.filter(preset => 
    !existingWheelTypes.includes(preset.value)
  )

  const groupedPresets = availablePresets.reduce((acc, preset) => {
    if (!acc[preset.category]) {
      acc[preset.category] = []
    }
    acc[preset.category].push(preset)
    return acc
  }, {} as Record<string, WheelTypePreset[]>)

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Add from Presets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Wheel Type Presets
          </DialogTitle>
          <DialogDescription>
            Choose from pre-configured wheel types designed for different educational and activity needs.
          </DialogDescription>
        </DialogHeader>
        
        <div className="h-[60vh] overflow-y-auto pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-swu-red mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading available presets...</p>
              </div>
            </div>
          ) : Object.keys(groupedPresets).length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">All Presets Added!</h3>
              <p className="text-sm text-muted-foreground">All available wheel type presets have been added to your system.</p>
              <p className="text-sm text-muted-foreground mt-1">Delete wheel types from the main list to make them available here again.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedPresets).map(([category, presets]) => (
                <div key={category}>
                  <h3 className="text-lg font-semibold mb-3 text-swu-red">{category}</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {presets.map((preset) => (
                    <Card key={preset.value} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span className="text-lg">{preset.icon}</span>
                          {preset.label}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {preset.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex flex-wrap gap-1 mb-3">
                          {preset.allowedRoles.map((role) => (
                            <Badge key={role} variant="outline" className="text-xs">
                              {role}
                            </Badge>
                          ))}
                          {preset.isActivityWheel && (
                            <Badge variant="secondary" className="text-xs">Activity</Badge>
                          )}
                          {preset.canBeShared && (
                            <Badge variant="secondary" className="text-xs">Shareable</Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPreset(preset)
                            setTargetSelectionOpen(true)
                          }}
                          disabled={addingPreset === preset.value}
                          className="w-full"
                        >
                          {addingPreset === preset.value ? (
                            "Adding..."
                          ) : (
                            <>
                              <Plus className="h-3 w-3 mr-1" />
                              Add This Type
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>

      {/* Target Selection Dialog */}
      <Dialog open={targetSelectionOpen} onOpenChange={setTargetSelectionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Choose Distribution Target
            </DialogTitle>
            <DialogDescription>
              Select who should receive the "{selectedPreset?.label}" wheel type.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <RadioGroup value={distributionTarget} onValueChange={(value) => setDistributionTarget(value as "all" | "participants" | "organizers" | "specific")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  All Users
                  <Badge variant="outline">Default</Badge>
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="participants" id="participants" />
                <Label htmlFor="participants" className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Participants Only
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="organizers" id="organizers" />
                <Label htmlFor="organizers" className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4" />
                  Organizers Only
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="specific" id="specific" />
                <Label htmlFor="specific" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Specific Users
                </Label>
              </div>
            </RadioGroup>

            {distributionTarget === "specific" && (
              <div className="space-y-2">
                <Label htmlFor="user-emails">User Emails (comma-separated)</Label>
                <Textarea
                  id="user-emails"
                  value={specificUserEmails}
                  onChange={(e) => setSpecificUserEmails(e.target.value)}
                  placeholder="user1@example.com, user2@example.com"
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  Enter email addresses of users who should receive this wheel type.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="custom-message">Custom Notification Message (Optional)</Label>
              <Input
                id="custom-message"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={`New wheel type "${selectedPreset?.label}" is now available!`}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTargetSelectionOpen(false)
                setDistributionTarget("all")
                setSpecificUserEmails("")
                setCustomMessage("")
                setSelectedPreset(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPresetWithTarget}
              disabled={addingPreset !== null || (distributionTarget === "specific" && !specificUserEmails.trim())}
              className="bg-swu-red hover:bg-swu-red/90 text-white"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Add Wheel Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )

  async function handleAddPresetWithTarget() {
    if (!selectedPreset) return

    setAddingPreset(selectedPreset.value)
    try {
      // Add the wheel type to the global collection
      const docRef = await addDoc(collection(db, "wheelTypes"), {
        value: selectedPreset.value,
        label: selectedPreset.label,
        description: selectedPreset.description,
        enabled: true,
        order: Date.now(),
        allowedRoles: selectedPreset.allowedRoles,
        isActivityWheel: selectedPreset.isActivityWheel,
        canBeShared: selectedPreset.canBeShared,
        defaultItems: selectedPreset.defaultItems || ["Option 1", "Option 2", "Option 3", "Option 4"],
        defaultSettings: selectedPreset.defaultSettings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPreset: true,
        category: selectedPreset.category,
        icon: selectedPreset.icon,
        distributionTarget: distributionTarget,
        specificUsers: distributionTarget === "specific" ? specificUserEmails.split(",").map(email => email.trim()).filter(Boolean) : []
      })

      // Handle different distribution targets
      let targetUsers: string[] = []
      
      if (distributionTarget === "all") {
        // Global distribution - notify all users
        await addDoc(collection(db, "systemNotifications"), {
          type: "wheelTypeAdded",
          wheelTypeId: docRef.id,
          wheelTypeLabel: selectedPreset.label,
          message: customMessage || `New wheel type "${selectedPreset.label}" is now available!`,
          createdAt: serverTimestamp(),
          isActive: true,
          targetRoles: ["admin", "organizer", "participant"],
          priority: "normal"
        })
      } else {
        // Targeted distribution
        
        if (distributionTarget === "participants" || distributionTarget === "organizers") {
          // Query users by role
          const usersQuery = query(
            collection(db, "users"),
            where("role", "==", distributionTarget === "participants" ? "participant" : "organizer")
          )
          const usersSnapshot = await getDocs(usersQuery)
          targetUsers = usersSnapshot.docs.map(doc => doc.data().email || doc.data().uid)
        } else if (distributionTarget === "specific") {
          targetUsers = specificUserEmails.split(",").map(email => email.trim()).filter(Boolean)
        }

        // Create user-specific wheel type entries
        const batch = []
        for (const userIdentifier of targetUsers) {
          batch.push(
            addDoc(collection(db, "userWheelTypes"), {
              userId: userIdentifier,
              wheelTypeId: docRef.id,
              wheelTypeValue: selectedPreset.value,
              wheelTypeLabel: selectedPreset.label,
              wheelTypeDescription: selectedPreset.description,
              wheelTypeIcon: selectedPreset.icon,
              category: selectedPreset.category,
              allowedRoles: selectedPreset.allowedRoles,
              isActivityWheel: selectedPreset.isActivityWheel,
              canBeShared: selectedPreset.canBeShared,
              defaultSettings: selectedPreset.defaultSettings,
              addedAt: serverTimestamp(),
              addedBy: "admin",
              isPreset: true,
              distributionMethod: distributionTarget
            })
          )

          // Create notification for each user
          batch.push(
            addDoc(collection(db, "systemNotifications"), {
              type: "wheelTypeAdded",
              wheelTypeId: docRef.id,
              wheelTypeLabel: selectedPreset.label,
              message: customMessage || `New wheel type "${selectedPreset.label}" has been added to your wheel types!`,
              createdAt: serverTimestamp(),
              isActive: true,
              targetUser: userIdentifier,
              targetRoles: distributionTarget === "participants" ? ["participant"] : ["organizer"],
              priority: "normal",
              distributionMethod: distributionTarget
            })
          )
        }

        // Execute all batch operations
        await Promise.all(batch)

        // Also add to saved wheels for easier access
        for (const userIdentifier of targetUsers) {
          try {
            await addDoc(collection(db, "wheelPresets"), {
              title: selectedPreset.label,
              description: selectedPreset.description,
              category: selectedPreset.category.toLowerCase(),
              participants: [], // Will be populated when used
              settings: {
                numberOfWinners: 1,
                theme: "default",
                hasConfetti: selectedPreset.defaultSettings.allowRealTimeCollection || false,
                hasSound: true,
                congratsMessage: selectedPreset.defaultSettings.congratsMessage || "Congratulations, {winner}!"
              },
              isFavorite: false,
              timesUsed: 0,
              createdAt: serverTimestamp(),
              createdBy: userIdentifier,
              wheelType: selectedPreset.value,
              isFromPreset: true,
              presetId: docRef.id,
              addedByAdmin: true
            })
          } catch (error) {
            console.warn("Could not add to saved wheels for user:", userIdentifier, error)
          }
        }
      }

      toast({
        title: "✨ Wheel Type Added & Activated!",
        description: `${selectedPreset.label} has been distributed to ${distributionTarget === "all" ? "all users" : distributionTarget === "specific" ? `${targetUsers.length} specific users` : distributionTarget} and is now visible in both solo and live wheel galleries.`,
      })

      // Reset form
      setTargetSelectionOpen(false)
      setDistributionTarget("all")
      setSpecificUserEmails("")
      setCustomMessage("")
      setSelectedPreset(null)
      onPresetAdded?.()
    } catch (error: any) {
      console.error("Error adding preset with target:", error)
      toast({
        title: "Error Adding Wheel Type",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setAddingPreset(null)
    }
  }
}
