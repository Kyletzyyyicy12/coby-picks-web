"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PICKER_WHEEL_TYPES, PICKER_CATEGORIES, getVisiblePickerWheels, type PickerWheelType } from "@/lib/picker-wheel-types"
import { Search, Filter, Sparkles, Loader2, Wifi } from "lucide-react"
import { useRouter } from "next/navigation"
import { QuickActivityCreator } from "./quick-activity-creator"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, type User } from "firebase/auth"
import { useWheelTypes } from "@/components/providers/wheel-type-provider"

interface PickerWheelGalleryProps {
  onSelectWheel?: (wheel: PickerWheelType) => void
  userRole?: string | null
  user?: User | null
}

export function PickerWheelGallery({ onSelectWheel, userRole: propUserRole, user: propUser }: PickerWheelGalleryProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedWheelForActivity, setSelectedWheelForActivity] = useState<PickerWheelType | null>(null)
  const [user, setUser] = useState<User | null>(propUser || null)
  const [userRole, setUserRole] = useState<string | null>(propUserRole || null)
  const router = useRouter()

  // Get real-time wheel types from Firestore
  const { enabledWheelTypes, loading: wheelTypesLoading, error: wheelTypesError } = useWheelTypes()

  useEffect(() => {
    // If user and role are provided as props, use those instead of auth listener
    if (propUser !== undefined && propUserRole !== undefined) {
      setUser(propUser)
      setUserRole(propUserRole)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      // Note: userRole would need to be fetched from Firestore in a real scenario
      // For now, we'll rely on the prop or default to student
    })
    return () => unsubscribe()
  }, [propUser, propUserRole])

  // Combine static wheel types with dynamic ones from Firestore, applying visibility filtering
  const allWheelTypes = useMemo(() => {
    // Apply visibility filtering to static wheel types based on user role
    const visibleStaticWheels = getVisiblePickerWheels(userRole || "participant")
    
    const dynamicWheels: PickerWheelType[] = enabledWheelTypes.map(wheelType => {
      // Find matching static wheel to get proper default items and settings
      const matchingStaticWheel = PICKER_WHEEL_TYPES.find(sw => sw.id === wheelType.value)
      
      return {
        id: wheelType.value,
        title: wheelType.label,
        description: wheelType.description,
        icon: wheelType.icon || matchingStaticWheel?.icon || "🎯", // Use preset icon, static icon, or default
        // Map dynamic wheels into simplified categories
        category: ((): string => {
          // Use preset category if available, otherwise map from label
          if (wheelType.category) {
            const categoryMapping: Record<string, string> = {
              "Picker Wheels": "personal",
              "Academic Activities": "academic",
              "Research Tools": "research",
              "Entertainment": "entertainment",
              "Special Events": "entertainment"
            }
            return categoryMapping[wheelType.category] || "personal"
          }
          
          // Use static wheel category if available
          if (matchingStaticWheel) {
            return matchingStaticWheel.category
          }
          
          const label = (wheelType.label || "").toLowerCase()
          if (label.includes("research") || label.includes("survey") || label.includes("experiment")) return "research"
          if (label.includes("class") || label.includes("quiz") || label.includes("student") || wheelType.isActivityWheel) return "academic"
          if (label.includes("game") || label.includes("movie") || label.includes("team")) return "entertainment"
          return "personal"
        })(),
        defaultItems: wheelType.defaultItems || matchingStaticWheel?.defaultItems || ["Option 1", "Option 2", "Option 3"],
        color: matchingStaticWheel?.color || "#8e0b16", // Use static wheel color or default
        isCustomizable: matchingStaticWheel?.isCustomizable ?? true,
        maxItems: matchingStaticWheel?.maxItems,
        minItems: matchingStaticWheel?.minItems,
        isDynamic: true, // Mark as dynamic wheel type
        allowedRoles: wheelType.allowedRoles,
        canBeShared: wheelType.canBeShared,
        features: matchingStaticWheel?.features
      }
    })

    // Deduplicate: If a dynamic wheel has the same ID/value as a static wheel, 
    // the dynamic wheel should override the static one (this handles preset activation)
    const dynamicWheelIds = new Set(dynamicWheels.map(w => w.id))
    const filteredStaticWheels = visibleStaticWheels.filter(staticWheel => !dynamicWheelIds.has(staticWheel.id))

    return [...filteredStaticWheels, ...dynamicWheels]
  }, [enabledWheelTypes, userRole])

  const [sortBy, setSortBy] = useState<"title" | "category">("title")
  const [selectionCriteria, setSelectionCriteria] = useState<{ customizable?: boolean; maxItems?: number | null }>({})

  const filteredWheels = allWheelTypes
    .filter(wheel => {
      const matchesSearch = wheel.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           wheel.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesCategory = selectedCategory === "all" || wheel.category === selectedCategory
      const matchesCustomizable = selectionCriteria.customizable === undefined || wheel.isCustomizable === selectionCriteria.customizable
      const matchesMaxItems = selectionCriteria.maxItems == null || (wheel.maxItems || Infinity) >= selectionCriteria.maxItems
      return matchesSearch && matchesCategory && matchesCustomizable && matchesMaxItems
    })
    .sort((a, b) => sortBy === "title" ? a.title.localeCompare(b.title) : a.category.localeCompare(b.category))

  const handleWheelSelect = (wheel: PickerWheelType) => {
    // Students and non-authenticated users can use wheels directly
    if (!user || userRole === "student") {
      if (onSelectWheel) {
        onSelectWheel(wheel)
      } else {
        // Fallback: navigate to individual picker wheel page
        router.push(`/picker-wheel/${wheel.id}`)
      }
    } else {
      // Teachers and organizers go through activity creation modal
      setSelectedWheelForActivity(wheel)
      setIsModalOpen(true)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-8 w-8 text-swu-red" />
          <h1 className="text-4xl font-bold text-swu-red">Picker Wheel Gallery</h1>
          {!wheelTypesLoading && (
            <div className="flex items-center gap-1 text-green-600">
              <Wifi className="h-4 w-4" />
              <span className="text-xs font-medium">Live</span>
            </div>
          )}
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose from our collection of specialized picker wheels for every occasion.
          From simple decision making to team selection and random generation.
          {enabledWheelTypes.length > 0 && (
            <span className="block text-sm text-green-600 mt-2">
              ✨ {enabledWheelTypes.length} custom wheel type(s) available in real-time!
            </span>
          )}
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search picker wheels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {PICKER_CATEGORIES.map(category => (
                <SelectItem key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="title">Sort: Title</SelectItem>
              <SelectItem value="category">Sort: Category</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          variant={selectedCategory === "all" ? "default" : "outline"}
          onClick={() => setSelectedCategory("all")}
          className={selectedCategory === "all" ? "bg-swu-red text-white" : ""}
        >
          All Wheels ({allWheelTypes.length})
        </Button>
        {PICKER_CATEGORIES.map(category => {
          const count = allWheelTypes.filter(w => w.category === category.id).length
          return (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.id)}
              className={selectedCategory === category.id ? "bg-swu-red text-white" : ""}
            >
              {category.icon} {category.name} ({count})
            </Button>
          )
        })}
      </div>

      {/* Results Count */}
      <div className="text-center text-muted-foreground">
        {wheelTypesLoading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading wheel types...</span>
          </div>
        ) : (
          <span>
            Showing {filteredWheels.length} of {allWheelTypes.length} picker wheels
            {enabledWheelTypes.length > 0 && (
              <span className="text-green-600 ml-2">
                (including {enabledWheelTypes.length} custom types)
              </span>
            )}
          </span>
        )}
      </div>

      {/* Wheel Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWheels.map(wheel => (
          <Card 
            key={wheel.id} 
            className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-swu-red/20"
            onClick={() => handleWheelSelect(wheel)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="text-3xl p-2 rounded-lg"
                    style={{ backgroundColor: `${wheel.color}20` }}
                  >
                    {wheel.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg leading-tight flex items-center gap-2">
                      {wheel.title}
                      {(wheel as any).isDynamic && (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          <Wifi className="h-3 w-3 mr-1" />
                          Live
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex gap-1 mt-1">
                      <Badge
                        variant="secondary"
                        className="text-xs"
                        style={{ backgroundColor: `${wheel.color}20`, color: wheel.color }}
                      >
                        {PICKER_CATEGORIES.find(c => c.id === wheel.category)?.name || wheel.category}
                      </Badge>
                      {(wheel as any).isDynamic && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          Custom
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <CardDescription className="text-sm mb-4 line-clamp-3">
                {wheel.description}
              </CardDescription>
              
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Default items:</span> {wheel.defaultItems.length}
                  {wheel.isCustomizable && " • Customizable"}
                </div>
                
                <Button
                  className="w-full text-white hover:opacity-90"
                  style={{ backgroundColor: wheel.color }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleWheelSelect(wheel)
                  }}
                >
                  {user && userRole !== "student" ? "Create Activity" : "Use This Wheel"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No Results */}
      {filteredWheels.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold mb-2">No wheels found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your search terms or category filter
          </p>
          <Button 
            variant="outline" 
            onClick={() => {
              setSearchTerm("")
              setSelectedCategory("all")
            }}
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* Featured Categories */}
      <div className="mt-12 space-y-6">
        <h2 className="text-2xl font-bold text-center">Popular Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PICKER_CATEGORIES.slice(0, 4).map(category => {
            const categoryWheels = PICKER_WHEEL_TYPES.filter(w => w.category === category.id)
            return (
              <Card 
                key={category.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedCategory(category.id)}
              >
                <CardContent className="p-4 text-center">
                  <div className="text-3xl mb-2">{category.icon}</div>
                  <h3 className="font-semibold">{category.name}</h3>
                  <p className="text-sm text-muted-foreground">{categoryWheels.length} wheels</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Curated category list with items for quick discovery */}
      <div className="mt-12 space-y-4">
        <h2 className="text-2xl font-bold text-center">Categories</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { id: "research", name: "Research", items: ["Survey groups", "Experiment IDs", "Country/State lists"] },
            { id: "academic", name: "Academic", items: ["Class presentation order", "Quiz topics", "Group leaders"] },
            { id: "entertainment", name: "Entertainment", items: ["Game night", "Movie picks", "Team picker"] },
            { id: "personal", name: "Personal", items: ["Chores", "Who pays?", "What to eat?"] },
          ].map((cat) => (
            <Card key={`${cat.name}`} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{cat.name}</span>
                  <Button size="sm" variant="outline" onClick={() => setSelectedCategory(cat.id)}>
                    Browse
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {cat.items.map((it, idx) => (
                    <Badge key={idx} variant="secondary" className="cursor-pointer"
                      onClick={() => setSearchTerm(it.replace(/[^a-z0-9 ]/gi, "").toLowerCase())}
                    >
                      {it}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Selection Criteria */}
      <div className="mt-8 max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-sm">Customizable</Label>
          <Select
            value={selectionCriteria.customizable === undefined ? "any" : selectionCriteria.customizable ? "yes" : "no"}
            onValueChange={(v: string) => setSelectionCriteria(prev => ({ ...prev, customizable: v === "any" ? undefined : v === "yes" }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="yes">Yes</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Minimum Max Items</Label>
          <Input
            type="number"
            placeholder="e.g. 10"
            onChange={(e) => setSelectionCriteria(prev => ({ ...prev, maxItems: e.target.value ? Number(e.target.value) : null }))}
          />
        </div>
      </div>

      {/* Quick Activity Creator Modal */}
      <QuickActivityCreator
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedWheelForActivity(null)
        }}
        selectedWheel={selectedWheelForActivity}
      />
    </div>
  )
}
