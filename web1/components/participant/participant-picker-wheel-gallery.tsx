"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Target, Users, Calendar, Trophy, Search, Filter, Wifi, Loader2 } from "lucide-react"
import { PICKER_WHEEL_TYPES, getVisiblePickerWheels, PICKER_CATEGORIES } from "@/lib/picker-wheel-types"
import type { PickerWheelType } from "@/lib/picker-wheel-types"
import { DynamicPickerWheel } from "@/components/picker-wheels/dynamic-picker-wheel"
import { useWheelTypes } from "@/components/providers/wheel-type-provider"
import type { User as FirebaseUser } from "firebase/auth"

interface ParticipantPickerWheelGalleryProps {
  user?: FirebaseUser | null
  onBack?: () => void
}

export function ParticipantPickerWheelGallery({ user, onBack }: ParticipantPickerWheelGalleryProps) {
  const [selectedWheel, setSelectedWheel] = useState<PickerWheelType | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  // Get real-time wheel types from Firestore
  const { enabledWheelTypes, loading: wheelTypesLoading } = useWheelTypes()

  // School colors for consistent styling
  const schoolColors = {
    primary: "#8e0b16",      // Main red
    secondary: "#66181E",    // Dark red/maroon
    accent: "#ffffff",       // White
    background: "#f8f9fa"    // Light background
  }

  // Combine static wheel types with dynamic ones from Firestore, applying visibility filtering
  const allWheelTypes = useMemo(() => {
    // Apply visibility filtering to static wheel types based on participant role
    const visibleStaticWheels = getVisiblePickerWheels("participant")
    
    const dynamicWheels: PickerWheelType[] = enabledWheelTypes
      .filter(wheelType => {
        // Filter for participant role and visibility
        const hasRolePermission = wheelType.allowedRoles.includes("participant") || wheelType.allowedRoles.includes("all")
        if (!hasRolePermission) return false
        
        // Dynamic wheels from presets should be visible (hiddenForNewUsers: false)
        return !wheelType.hiddenForNewUsers
      })
      .map(wheelType => {
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
  }, [enabledWheelTypes])

  // Filter wheels based on search and category
  const filteredWheels = allWheelTypes.filter(wheel => {
    const matchesSearch = wheel.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         wheel.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "all" || wheel.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Get unique categories for filter from all visible wheels
  const categories = ["all", ...new Set(allWheelTypes.map(wheel => wheel.category))]

  // If a wheel is selected, show the wheel interface in solo mode
  if (selectedWheel) {
    return (
      <div className="container mx-auto px-4 py-8">
        <DynamicPickerWheel
          wheelType={selectedWheel}
          onBack={() => setSelectedWheel(null)}
          isStudentMode={true} // Force solo mode for participants
          user={user}
          soloMode={true} // New prop to ensure no live session options
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: schoolColors.background }}>
      {/* Header */}
      <div 
        className="w-full py-6 px-4 mb-8"
        style={{ 
          backgroundColor: schoolColors.secondary,
          background: `linear-gradient(135deg, ${schoolColors.secondary} 0%, ${schoolColors.primary} 100%)`
        }}
      >
        <div className="container mx-auto">
          <div className="flex items-center gap-4">
            {onBack && (
              <Button
                onClick={onBack}
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">
                🎯 Solo Picker Wheels
                {!wheelTypesLoading && enabledWheelTypes.length > 0 && (
                  <span className="ml-2 text-sm font-normal opacity-90">
                    ({enabledWheelTypes.length} live types available)
                  </span>
                )}
              </h1>
              <p className="text-white/90">
                Create and play wheels by yourself - no live sessions, just instant fun!
                {!wheelTypesLoading && enabledWheelTypes.length > 0 && (
                  <span className="block text-sm mt-1 opacity-80">
                    ✨ Including {enabledWheelTypes.filter(t => !t.hiddenForNewUsers && (t.allowedRoles.includes("participant") || t.allowedRoles.includes("all"))).length} activated preset wheels
                  </span>
                )}
              </p>
            </div>
            {user && (
              <div className="text-sm text-white/80 px-3 py-1 rounded-md bg-white/10">
                {user.displayName || user.email}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-8">
        {/* Search and Filter Controls */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search wheels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map((category) => {
                const categoryInfo = PICKER_CATEGORIES.find(c => c.id === category)
                const categoryName = category === "all" ? "All Categories" : 
                                   categoryInfo ? `${categoryInfo.icon} ${categoryInfo.name}` : 
                                   category.charAt(0).toUpperCase() + category.slice(1)
                
                return (
                  <Badge
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    className={`cursor-pointer transition-colors ${
                      selectedCategory === category 
                        ? "text-white" 
                        : "hover:bg-gray-100"
                    }`}
                    style={{
                      backgroundColor: selectedCategory === category ? schoolColors.primary : undefined,
                      borderColor: schoolColors.primary
                    }}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {categoryName}
                  </Badge>
                )
              })}              
            </div>
          </div>
        </div>

        {/* No Live Session Notice */}
        <div className="mb-6">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <Target className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-blue-800">Solo Play Mode</p>
                  <p className="text-sm text-blue-600">
                    These wheels are for personal use only. You can't create live sessions or invite others to join.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loading State */}
        {wheelTypesLoading && (
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: schoolColors.primary }} />
              <span className="text-muted-foreground">Loading wheel types...</span>
            </div>
          </div>
        )}

        {/* Results Count */}
        {!wheelTypesLoading && (
          <div className="text-center text-muted-foreground mb-4">
            <span>
              Showing {filteredWheels.length} of {allWheelTypes.length} picker wheels
              {enabledWheelTypes.length > 0 && (
                <span className="text-green-600 ml-2">
                  (including {enabledWheelTypes.filter(t => !t.hiddenForNewUsers && (t.allowedRoles.includes("participant") || t.allowedRoles.includes("all"))).length} preset types)
                </span>
              )}
            </span>
          </div>
        )}

        {/* Wheels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!wheelTypesLoading && filteredWheels.map((wheel) => (
            <Card key={wheel.id} className="hover:shadow-lg transition-all duration-200 group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{wheel.icon}</span>
                    <Badge 
                      variant="outline" 
                      className="text-xs"
                      style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
                    >
                      {(() => {
                        const categoryInfo = PICKER_CATEGORIES.find(c => c.id === wheel.category)
                        return categoryInfo ? `${categoryInfo.icon} ${categoryInfo.name}` : wheel.category
                      })()}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Solo Play
                  </div>
                </div>
                <CardTitle className="text-lg group-hover:text-red-600 transition-colors">
                  {wheel.title}
                </CardTitle>
                <CardDescription className="text-sm">
                  {wheel.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Default Items Preview */}
                  {wheel.defaultItems && wheel.defaultItems.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Sample Items:</p>
                      <div className="flex flex-wrap gap-1">
                        {wheel.defaultItems.slice(0, 4).map((item, index) => (
                          <Badge 
                            key={index} 
                            variant="outline" 
                            className="text-xs px-2 py-1"
                          >
                            {item}
                          </Badge>
                        ))}
                        {wheel.defaultItems.length > 4 && (
                          <Badge variant="outline" className="text-xs px-2 py-1">
                            +{wheel.defaultItems.length - 4} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Features */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    ✅ Customizable items<br />
                    ✅ Instant results<br />
                    ✅ No time limits<br />
                    ❌ Live sessions disabled
                  </div>

                  {/* Play Button */}
                  <Button
                    onClick={() => setSelectedWheel(wheel)}
                    className="w-full text-white group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: schoolColors.primary }}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Play Solo
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
            <h3 className="text-xl font-semibold mb-2" style={{ color: schoolColors.primary }}>
              No wheels found
            </h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search terms or category filter
            </p>
            <Button
              onClick={() => {
                setSearchQuery("")
                setSelectedCategory("all")
              }}
              variant="outline"
              style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
            >
              Clear Filters
            </Button>
          </div>
        )}

        {/* Categories Info */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { 
              category: "academic", 
              name: "Academic", 
              description: "Perfect for classroom activities and educational games",
              examples: ["Class presentation order", "Quiz topics", "Group formation"]
            },
            { 
              category: "research", 
              name: "Research", 
              description: "Great for research studies and data collection",
              examples: ["Survey groups", "Experiment conditions", "Sample selection"]
            },
            { 
              category: "entertainment", 
              name: "Entertainment", 
              description: "Fun activities for games and social events",
              examples: ["Game night choices", "Movie picks", "Team assignments"]
            },
            { 
              category: "personal", 
              name: "Personal", 
              description: "Everyday decisions and personal choices",
              examples: ["What to eat", "Chore assignments", "Weekend activities"]
            }
          ].map((cat) => (
            <Card key={cat.category} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{cat.name}</span>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setSelectedCategory(cat.category)}
                    style={{ borderColor: schoolColors.primary, color: schoolColors.primary }}
                  >
                    Browse
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">{cat.description}</p>
                <div className="space-y-1">
                  {cat.examples.map((example, index) => (
                    <div key={index} className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                      {example}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}