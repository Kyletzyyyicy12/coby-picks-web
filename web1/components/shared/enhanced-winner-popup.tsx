"use client"

import { useState, useEffect } from "react"
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
}

export function EnhancedWinnerPopup({
  isOpen,
  onClose,
  winners,
  congratsMessage = "🏆  Congratulations! You are the winner! 🎉 🏆",
  customWinnerMessage = "🏆 🎊 Congratulations! 🎊 🏆",
  customWinnerWord = "Winner",
  wheelType = "regular",
  showConfetti = true,
  autoClose = 10, // Default auto-close after 10 seconds
  customTitle,
  theme
}: EnhancedWinnerPopupProps) {
  const [animationPhase, setAnimationPhase] = useState<"enter" | "celebrate" | "display">("enter")
  const [displayedWinners, setDisplayedWinners] = useState<Winner[]>([])
  // 🔄 SINGLE-CONFETTI FIX: Track previously celebrated winners to prevent duplicate celebrations
  const [celebratedWinnerIds, setCelebratedWinnerIds] = useState<Set<string>>(new Set())

  // Trigger confetti and animations when popup opens - SINGLE CELEBRATION ONLY
  useEffect(() => {
    if (isOpen && winners.length > 0) {
      setAnimationPhase("enter")

      // 🔄 SINGLE-CONFETTI FIX: Check if we already celebrated any of these winners
      const currentWinnerIds = new Set(winners.map(w => w.id))
      const hasUncelebratedWinners = Array.from(currentWinnerIds).some(id => !celebratedWinnerIds.has(id))

      console.log('🎯 WINNER POPUP: Checking for duplicate celebrations', {
        currentWinners: winners.map(w => `${w.name}(${w.id})`),
        celebratedWinnerIds: Array.from(celebratedWinnerIds),
        hasUncelebratedWinners: hasUncelebratedWinners,
        willTriggerConfetti: hasUncelebratedWinners && showConfetti
      })

      // Show confetti only if we have uncelebrated winners and confetti is enabled
      if (showConfetti && hasUncelebratedWinners) {
        // Mark these winners as celebrated
        setCelebratedWinnerIds(prev => new Set([...prev, ...currentWinnerIds]))

        console.log('🎉 CONFETTI TRIGGERED - Single celebration confirmed for new winners')

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
        console.log('🎯 PARTICIPANT: Skipping confetti - all winners already celebrated')
      }

      // Always run animation sequence regardless of confetti
      setTimeout(() => setAnimationPhase("celebrate"), 800)
      setTimeout(() => {
        setAnimationPhase("display")
        setDisplayedWinners(winners)
      }, 1500)

      // Auto close if specified
    if (autoClose) {
      setTimeout(() => onClose(), autoClose * 1000)
    }
  }
}, [isOpen, winners, showConfetti, autoClose, onClose, celebratedWinnerIds])

// 🔄 SINGLE-CONFETTI FIX: Reset celebrated winners when popup closes
useEffect(() => {
  if (!isOpen) {
    console.log('🧹 resetting celebrated winners when popup closes')
    setCelebratedWinnerIds(new Set())
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
                ? "linear-gradient(135deg, #9333ea, #ec4899, #dc2626)"
                : theme
                ? `linear-gradient(135deg, ${theme.primary}, ${theme.secondary}, ${theme.primary})`
                : "linear-gradient(135deg, #f59e0b, #f97316, #dc2626)"
            }}
          >
            {/* Floating Icons Animation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[Trophy, Crown, Star, Medal, Award, PartyPopper].map((Icon, index) => (
                <Icon
                  key={index}
                  className={`
                    absolute text-white/20 animate-bounce
                    ${index % 2 === 0 ? "animate-pulse" : "animate-ping"}
                  `}
                  style={{
                    left: `${10 + (index * 15)}%`,
                    top: `${5 + (index * 8)}%`,
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
                <div className="text-8xl mb-4 filter drop-shadow-lg">
                  {isImagePicker ? "🖼️" : isMultipleWinners ? "👥" : "🏆"}
                </div>
                
                <h1 className="text-4xl md:text-6xl font-black text-white mb-2 drop-shadow-lg">
                  {customTitle || (isMultipleWinners ? `🏆  ${customWinnerWord.toUpperCase()}S! 🎉 🏆` : `🏆 🎉 ${customWinnerWord.toUpperCase()}! 🎉 🏆`)}
                </h1>

                <div className="flex justify-center items-center gap-2 mb-4">
                  <Sparkles className="text-yellow-300 animate-spin" size={24} />
                  <p className="text-xl md:text-2xl text-white font-bold drop-shadow">
                    {isMultipleWinners ? `${winners.length} ` : ""}
                  </p>
                  <Sparkles className="text-yellow-300 animate-spin" size={24} />
                </div>
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
                    <CardContent className="p-6 text-center space-y-4">
                      {/* Winner Rank Badge */}
                      <div className="flex justify-center">
                        <Badge
                          className={`
                            text-white text-lg px-4 py-2 font-bold shadow-lg animate-pulse
                          `}
                          style={{
                            background: isImagePicker
                              ? "linear-gradient(90deg, #9333ea, #ec4899)"
                              : theme
                              ? `linear-gradient(90deg, ${theme.primary}, ${theme.secondary})`
                              : "linear-gradient(90deg, #f59e0b, #f97316)"
                          }}
                        >
                          <Crown className="h-5 w-5 mr-2" />
                          #{index + 1} Winner
                        </Badge>
                      </div>

                      {/* Winner Image or Avatar */}
                      <div className="flex justify-center">
                        {winner.image?.url ? (
                          <div className="relative">
                            <img
                              src={winner.image.url}
                              alt={winner.image.alt || winner.name}
                              className={`
                                w-32 h-32 object-cover rounded-full 
                                border-6 shadow-xl
                                ${isImagePicker ? "border-purple-400" : "border-yellow-400"}
                                animate-pulse
                              `}
                            />
                            <div className="absolute -top-2 -right-2">
                              <div className="bg-yellow-400 rounded-full p-2 animate-spin">
                                <Trophy className="h-6 w-6 text-yellow-900" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div 
                            className={`
                              w-32 h-32 rounded-full border-6 shadow-xl
                              flex items-center justify-center text-5xl font-bold text-white
                              ${isImagePicker ? "border-purple-400" : "border-yellow-400"}
                              animate-pulse
                            `}
                            style={{ backgroundColor: winner.color || "#3B82F6" }}
                          >
                            {isImagePicker ? "🖼️" : "🏆"}
                          </div>
                        )}
                      </div>

                      {/* Winner Details */}
                      <div className="space-y-2">
                        <h3 className={`
                          text-2xl font-black
                          ${isImagePicker ? "text-purple-800" : "text-gray-800"}
                        `}>
                          {winner.name}
                        </h3>
                        
                        {winner.email && (
                          <p className="text-sm text-gray-600 font-medium">
                            📧 {winner.email}
                          </p>
                        )}
                        
                        {winner.contactNumber && (
                          <p className="text-sm text-gray-600 font-medium">
                            📱 {winner.contactNumber}
                          </p>
                        )}
                      </div>

                      {/* Celebration Icons */}
                      <div className="flex justify-center gap-2">
                        <Zap className="text-yellow-500 animate-bounce" size={20} />
                        <Star className="text-yellow-500 animate-pulse" size={20} />
                        <Medal className="text-yellow-500 animate-bounce" size={20} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Congratulations Message */}
            <div className="relative z-10 bg-white/90 backdrop-blur-sm mx-6 mb-6 rounded-2xl p-6 border-4 border-yellow-300">
              <div className="text-center">
                <h2 className={`
                  text-2xl font-bold mb-3
                  ${isImagePicker ? "text-purple-800" : "text-gray-800"}
                `}>
                  {customWinnerMessage.replace('{word}', customWinnerWord)}
                </h2>
                <p className="text-lg text-gray-700 leading-relaxed">
                  {congratsMessage.replace('{name}', winners.map(w => w.name).join(', '))}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="relative z-10 flex justify-center gap-4 pb-8 px-6">
              <Button
                onClick={onClose}
                size="lg"
                className={`
                  text-white font-bold px-8 py-3 text-lg rounded-xl shadow-lg
                  ${isImagePicker 
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
                    : "bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700"
                  }
                  transform hover:scale-105 transition-all duration-200
                `}
              >
                Awesome!
              </Button>
              
              {showConfetti && (
                <Button
                  onClick={() => {
                    confetti({
                      particleCount: 50, // Reduced from 200
                      spread: 60, // Reduced from 100
                      origin: { y: 0.7 },
                      colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1']
                    })
                  }}
                  variant="outline"
                  size="lg"
                  className="border-2 border-yellow-400 text-yellow-700 hover:bg-yellow-50 font-bold px-6 py-3 text-lg rounded-xl"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  More Celebration!
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}