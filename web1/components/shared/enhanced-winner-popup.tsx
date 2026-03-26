"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Crown, Star, Sparkles, PartyPopper, Zap, Medal, Award } from "lucide-react"
import confetti from "canvas-confetti"

interface Winner {
  id: string
  name: string
  email?: string
  contactNumber?: string
  isSelected?: boolean
  image?: {
    url: string
    alt?: string
  }
  color?: string
}

interface EnhancedWinnerPopupProps {
  isOpen: boolean
  onClose: () => void
  winners: Winner[]
  congratsMessage?: string
  customWinnerMessage?: string
  customWinnerWord?: string
  wheelType?: "image-picker" | "regular"
  showConfetti?: boolean
  autoClose?: number // Auto close after X seconds
  customTitle?: string
  theme?: {
    primary: string
    secondary: string
    accent: string
  } // Theme information from wheel
  imageSize?: "sm" | "md" | "lg" | "xl" // Custom image size
}

export function EnhancedWinnerPopup({
  isOpen,
  onClose,
  winners,
  congratsMessage,
   customWinnerMessage = "",
    customWinnerWord = "Selected",
   wheelType = "regular",
   showConfetti = true,
   autoClose = 10, // Default auto-close after 10 seconds
   customTitle,
   theme,
   imageSize = "md" // Default to medium size
}: EnhancedWinnerPopupProps) {
  // Default congrats message based on wheel type
  const defaultCongratsMessage = wheelType === "image-picker"
    ? "🎉 Amazing! {name} has been selected! 🎉"
    : "🎉 Congratulations! 🎉"

  // Use provided congratsMessage or computed default
  const actualCongratsMessage = congratsMessage || defaultCongratsMessage

  const [animationPhase, setAnimationPhase] = useState<"enter" | "celebrate" | "display">("enter")
  const [displayedWinners, setDisplayedWinners] = useState<Winner[]>([])
  // 🔄 SINGLE-CONFETTI FIX: Track previously celebrated winners to prevent duplicate celebrations
  const celebratedWinnerIdsRef = useRef<Set<string>>(new Set())

  // Trigger confetti and animations when popup opens - SINGLE CELEBRATION ONLY
  useEffect(() => {
    if (isOpen && winners.length > 0) {
      // 🔧 FIX: Ensure all winners have unique IDs for React keys (moved inside useEffect to prevent infinite loop)
      const winnersWithUniqueIds = winners.map((winner, index) => ({
        ...winner,
        id: winner.id || `winner-${index}-${Date.now()}`
      }))

      setAnimationPhase("enter")

      // 🔄 SINGLE-CONFETTI FIX: Check if we already celebrated any of these winners
      const currentWinnerIds = new Set(winnersWithUniqueIds.map(w => w.id))
      const hasUncelebratedWinners = Array.from(currentWinnerIds).some(id => !celebratedWinnerIdsRef.current.has(id))

      console.log('Checking for duplicate celebrations', {
        currentSelected: winnersWithUniqueIds.map(w => `${w.name}(${w.id})`),
        celebratedSelectedIds: Array.from(celebratedWinnerIdsRef.current),
        hasUncelebratedSelected: hasUncelebratedWinners,
        willTriggerConfetti: hasUncelebratedWinners && showConfetti
      })

      // Show confetti only if we have uncelebrated winners and confetti is enabled
      if (showConfetti && hasUncelebratedWinners) {
        // Mark these winners as celebrated
        currentWinnerIds.forEach(id => celebratedWinnerIdsRef.current.add(id))

        console.log('Confetti triggered for new selected')

        // Single coordinated burst - less intense
        confetti({
          particleCount: 80, // Reduced from 150
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1']
        })

        // Single delayed center burst - much reduced
        setTimeout(() => {
          confetti({
            particleCount: 40, // Reduced from 100
            angle: 90,
            spread: 45,
            origin: { x: 0.5, y: 0.5 },
            colors: ['#FFD700', '#FF6B6B', '#4ECDC4']
          })
        }, 600)

        // Brief sparkles for 2 seconds - less frequent, shorter duration
        const sparkleInterval = setInterval(() => {
          confetti({
            particleCount: 15, // Reduced from 30
            spread: 25,
            origin: { x: Math.random(), y: Math.random() * 0.3 }, // Less area
            colors: ['#FFD700', '#FFF700'],
            shapes: ['star']
          })
        }, 500) // Less frequent (every 500ms instead of 300ms)

        setTimeout(() => clearInterval(sparkleInterval), 2000) // Shorter duration

      } else if (showConfetti && !hasUncelebratedWinners) {
        console.log('Skipping confetti - all selected already celebrated')
      }

      // Always run animation sequence regardless of confetti
       setTimeout(() => setAnimationPhase("celebrate"), 800)
       setTimeout(() => {
         setAnimationPhase("display")
         setDisplayedWinners(winnersWithUniqueIds)
       }, 1500)

      // Auto close if specified - use a ref to avoid dependency issues
      if (autoClose) {
        const timer = setTimeout(() => {
          onClose()
        }, autoClose * 1000)

        return () => clearTimeout(timer)
      }
  }
 }, [isOpen, winners, showConfetti, autoClose]) // Removed celebratedWinnerIds and onClose

// 🔄 SINGLE-CONFETTI FIX: Reset celebrated winners when popup closes
useEffect(() => {
  if (!isOpen) {
    console.log('Resetting celebrated selected when popup closes')
    celebratedWinnerIdsRef.current.clear()
    setAnimationPhase("enter")
    setDisplayedWinners([])
  }
}, [isOpen])

  if (!isOpen || winners.length === 0) return null

  const isImagePicker = wheelType === "image-picker"
  const isMultipleWinners = winners.length > 1

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden border-0 bg-transparent shadow-none p-0">
        <DialogTitle className="sr-only">Winner Announcement Popup</DialogTitle>
        <div className="relative">
          {/* Animated Background */}
          <div 
            className={`
              fixed inset-0 bg-black/80 backdrop-blur-sm
              ${animationPhase === "enter" ? "animate-in fade-in-0 duration-500" : ""}
            `}
            style={{ zIndex: -1 }}
          />
          
          {/* Main Content */}
          <div
            className={`
              relative rounded-3xl shadow-2xl overflow-hidden border-4 border-white
              ${animationPhase === "enter" ? "animate-in zoom-in-95 duration-700" : ""}
              ${animationPhase === "celebrate" ? "animate-pulse" : ""}
            `}
            style={{
              background: isImagePicker
                ? `linear-gradient(135deg, #8e0b16, #66181E, #8e0b16)` // Maroon theme for image picker
                : theme
                ? `linear-gradient(135deg, ${theme.primary}, ${theme.secondary}, ${theme.primary})`
                : "linear-gradient(135deg, #f59e0b, #f97316, #dc2626)"
            }}
          >
            {/* Floating Icons Animation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[
                { Icon: Crown, name: 'crown', id: 'crown-1' },
                { Icon: Star, name: 'star', id: 'star-1' },
                { Icon: Medal, name: 'medal', id: 'medal-1' },
                { Icon: Award, name: 'award', id: 'award-1' }
              ].map((item, index) => (
                <item.Icon
                  key={item.id}
                  className={`
                    absolute text-white/20 animate-bounce
                    ${index % 2 === 0 ? "animate-pulse" : "animate-ping"}
                  `}
                  style={{
                    left: `${10 + (index * 20)}%`,
                    top: `${5 + (index * 10)}%`,
                    fontSize: `${20 + (index * 4)}px`,
                    animationDelay: `${index * 200}ms`,
                    animationDuration: `${2000 + (index * 300)}ms`
                  }}
                />
              ))}
            </div>

            {/* Header */}
            <div className="relative z-10 text-center py-8 px-6">
              <div
                className={`
                  ${animationPhase === "celebrate" ? "animate-bounce" : ""}
                  transition-all duration-500
                `}
              >
                <div className={`mb-4 filter drop-shadow-lg ${!isImagePicker ? 'text-8xl' : 'text-6xl'}`}>
                  {!isMultipleWinners && displayedWinners[0] ?
                    (isImagePicker ? '' : displayedWinners[0].name)
                    : ""}
                </div>


                {customWinnerMessage && !isImagePicker && (
                  <div className="flex justify-center items-center gap-2 mb-4">
                    <p className="text-xl md:text-2xl text-white font-bold drop-shadow">
                      {customWinnerMessage.replace('{word}', customWinnerWord).replace('{name}', displayedWinners.map(w => w.name).join(', '))}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Winners Display */}
            <div className="relative z-10 px-6 pb-8">
              <div className={`
                grid gap-6 
                ${isMultipleWinners ? "md:grid-cols-2 lg:grid-cols-3" : "place-items-center"}
                max-h-96 overflow-y-auto
              `}>
                {displayedWinners.map((winner, index) => (
                  <Card 
                    key={winner.id}
                    className={`
                      bg-white/95 backdrop-blur-sm border-4 border-yellow-300 shadow-2xl
                      transform hover:scale-105 transition-all duration-300
                      ${animationPhase === "display" ? "animate-in slide-in-from-bottom-4" : ""}
                      ${isImagePicker ? "border-purple-300" : ""}
                    `}
                    style={{ 
                      animationDelay: `${index * 150}ms`,
                      animationDuration: "600ms"
                    }}
                  >
                    <CardContent className="p-4 text-center space-y-4">
                      {/* Winner Image or Avatar */}
                      <div className="flex justify-center">
                        {winner.image?.url ? (
                          <div className="relative">
                            {(() => {
                              // Determine image size based on imageSize prop - make even bigger for winner announcement
                              let sizeClasses = "w-48 h-48" // default (md) - increased for winner announcement
                              if (imageSize === "sm") sizeClasses = "w-40 h-40"
                              else if (imageSize === "lg") sizeClasses = "w-64 h-64" // increased for winner announcement
                              else if (imageSize === "xl") sizeClasses = "w-72 h-72" // increased for winner announcement

                              return (
                                <img
                                  src={winner.image.url}
                                  alt={winner.image.alt || winner.name}
                                  className={`
                                    ${sizeClasses} object-cover
                                    border-6 shadow-xl
                                    ${isImagePicker ? "border-purple-400" : "border-yellow-400"}
                                    animate-pulse
                                  `}
                                  onError={(e) => { e.currentTarget.src = '/placeholder.jpg'; }}
                                />
                              )
                            })()}
                         </div>
                       ) : (
                          <div
                            className={`
                              w-40 h-40 rounded-full border-6 shadow-xl flex items-center justify-center text-5xl font-bold text-white
                              ${isImagePicker ? "border-purple-400" : "border-yellow-400"}
                              animate-pulse
                            `}
                            style={{ backgroundColor: winner.color || "#3B82F6" }}
                          >
                            {isImagePicker ? "" : (winner.name.charAt(0).toUpperCase() || "W")}
                          </div>
                        )}
                      </div>

                      {/* Winner Details - Simplified */}
                      <div className="space-y-2">
                        {!isImagePicker && (
                          <div className="text-xl font-bold text-gray-800">
                            {winner.name}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Congratulations Message */}
            {!isImagePicker && (
              <div className="relative z-10 bg-white/90 backdrop-blur-sm mx-6 mb-6 rounded-2xl p-6 border-4 border-yellow-300">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-3 text-gray-800">
                    {customWinnerMessage.replace('{word}', customWinnerWord).replace('{name}', displayedWinners.map(w => w.name).join(', '))}
                  </h2>
                  <p className="text-lg text-gray-700 leading-relaxed">
                    {actualCongratsMessage.replace('{name}', displayedWinners.map(w => w.name).join(', ')).replace('{word}', customWinnerWord.toLowerCase())}
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}