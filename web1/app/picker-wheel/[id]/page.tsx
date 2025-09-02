"use client"

import { useParams, useRouter } from "next/navigation"
import { DynamicPickerWheel } from "@/components/picker-wheels/dynamic-picker-wheel"
import { getPickerWheelById } from "@/lib/picker-wheel-types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function PickerWheelPage() {
  const params = useParams()
  const router = useRouter()
  const wheelId = params.id as string
  
  const wheelType = getPickerWheelById(wheelId)

  if (!wheelType) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold mb-2">Wheel Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The picker wheel you're looking for doesn't exist.
            </p>
            <Button onClick={() => router.push("/picker-wheels")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Gallery
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <DynamicPickerWheel 
        wheelType={wheelType}
        onBack={() => router.push("/picker-wheels")}
      />
    </div>
  )
}
