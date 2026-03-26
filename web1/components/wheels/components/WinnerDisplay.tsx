"use client"

import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EnhancedWinnerPopup } from "@/components/shared/enhanced-winner-popup"
import { WinnerResult } from '@/types/image-wheel-types'

interface WinnerDisplayProps {
  winner: WinnerResult | null
  showWinner: boolean
  onClose: () => void
}

export function WinnerDisplay({ winner, showWinner, onClose }: WinnerDisplayProps) {
  if (!winner || !winner.slice) return null

  return (
    <EnhancedWinnerPopup
      isOpen={showWinner}
      onClose={onClose}
      winners={[{
        id: winner.slice.id || `winner-${Date.now()}`,
        name: winner.slice.text || 'Unknown Winner',
        image: winner.slice.image ? {
          url: winner.slice.image?.url || '',
          alt: winner.slice.text || 'Winner'
        } : undefined,
        color: winner.slice.color || '#3B82F6'
      }]}
      congratsMessage="🎉 Congratulations! Your image has been selected! 🎉"
      wheelType="image-picker"
      showConfetti={winner.showConfetti}
      customTitle="🖼️ IMAGE WINNER! 🖼️"
    />
  )
}