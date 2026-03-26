"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import confetti from "canvas-confetti"

interface Winner {
  id: string
  name: string
  email?: string
  contactNumber?: string
  isSelected?: boolean
  color?: string
}

interface TextWinnerPopupProps {
  isOpen: boolean
  onClose: () => void
  winners: Winner[]
  congratsMessage?: string
  customWinnerMessage?: string
  customWinnerWord?: string
  showConfetti?: boolean
  autoClose?: number
  customTitle?: string
  theme?: {
    primary: string
    secondary: string
    accent: string
  }
}

export function TextWinnerPopup({
  isOpen,
  onClose,
  winners,
  congratsMessage,
  customWinnerMessage = "",
  customWinnerWord = "Selected",
  showConfetti = true,
  autoClose = 10,
  customTitle,
  theme,
}: TextWinnerPopupProps) {
  const defaultCongratsMessage = "🎉 Congratulations! "
  const actualCongratsMessage = congratsMessage || defaultCongratsMessage

  const [animationPhase, setAnimationPhase] = useState<"enter" | "celebrate" | "display">("enter")
  const [displayedWinners, setDisplayedWinners] = useState<Winner[]>([])
  const celebratedWinnerIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen && winners.length > 0) {
      const winnersWithUniqueIds = winners.map((winner, index) => ({
        ...winner,
        id: winner.id || `winner-${index}-${Date.now()}`
      }))

      setAnimationPhase("enter")

      const currentWinnerIds = new Set(winnersWithUniqueIds.map(w => w.id))
      const hasUncelebratedWinners = Array.from(currentWinnerIds).some(id => !celebratedWinnerIdsRef.current.has(id))

      if (showConfetti && hasUncelebratedWinners) {
        currentWinnerIds.forEach(id => celebratedWinnerIdsRef.current.add(id))

        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1']
        })

        setTimeout(() => {
          confetti({
            particleCount: 40,
            angle: 90,
            spread: 45,
            origin: { x: 0.5, y: 0.5 },
            colors: ['#FFD700', '#FF6B6B', '#4ECDC4']
          })
        }, 600)

        const sparkleInterval = setInterval(() => {
          confetti({
            particleCount: 15,
            spread: 25,
            origin: { x: Math.random(), y: Math.random() * 0.3 },
            colors: ['#FFD700', '#FFF700'],
            shapes: ['star']
          })
        }, 500)

        setTimeout(() => clearInterval(sparkleInterval), 2000)
      }

      setTimeout(() => setAnimationPhase("celebrate"), 800)
      setTimeout(() => {
        setAnimationPhase("display")
        setDisplayedWinners(winnersWithUniqueIds)
      }, 1500)

      if (autoClose) {
        const timer = setTimeout(() => {
          onClose()
        }, autoClose * 1000)

        return () => clearTimeout(timer)
      }
    }
  }, [isOpen, winners, showConfetti, autoClose])

  useEffect(() => {
    if (!isOpen) {
      celebratedWinnerIdsRef.current.clear()
      setAnimationPhase("enter")
      setDisplayedWinners([])
    }
  }, [isOpen])

  if (!isOpen || winners.length === 0) return null

  const isMultipleWinners = winners.length > 1

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden border-0 bg-transparent shadow-none p-0">
        <DialogTitle className="sr-only">Winner Announcement Popup</DialogTitle>
        <div className="relative">
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in-0 duration-500"
            style={{ zIndex: -1 }}
          />
          
          <div
            className="relative rounded-3xl shadow-2xl overflow-hidden border-4 border-white animate-in zoom-in-95 duration-700"
            style={{
              background: theme
                ? `linear-gradient(135deg, ${theme.primary}, ${theme.secondary}, ${theme.primary})`
                : "linear-gradient(135deg, #f59e0b, #f97316, #dc2626)"
            }}
          >
            <div className="relative z-10 text-center py-8 px-6">
            </div>

            <div className="relative z-10 px-6 pb-8">
              <div className={`grid gap-6 ${isMultipleWinners ? "md:grid-cols-2 lg:grid-cols-3" : "place-items-center"} max-h-96 overflow-y-auto`}>
                {displayedWinners.map((winner, index) => (
                  <Card 
                    key={winner.id}
                    className="bg-white/95 backdrop-blur-sm border-4 border-yellow-300 shadow-2xl transform hover:scale-105 transition-all duration-300 animate-in slide-in-from-bottom-4"
                    style={{ 
                      animationDelay: `${index * 150}ms`,
                      animationDuration: "600ms"
                    }}
                  >
                    <CardContent className="p-6 sm:p-8 text-center space-y-4">
                      <div className="space-y-2">
                        <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 break-words">
                          {winner.name}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div className="relative z-10 bg-white/90 backdrop-blur-sm mx-6 mb-6 rounded-2xl p-6 border-4 border-yellow-300">
              <div className="text-center">
                <p className="text-lg text-gray-700 leading-relaxed">
                  {actualCongratsMessage.replace('{name}', displayedWinners.length > 0 ? displayedWinners.map(w => w.name).join(', ') : 'winner').replace('{word}', customWinnerWord.toLowerCase())}
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}