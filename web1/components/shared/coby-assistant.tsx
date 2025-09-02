"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MessageCircle, X } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

function routeQueryToAnswer(query: string): string {
  const q = query.toLowerCase()
  // Basic keyword routing
  if (q.includes("room") || q.includes("code") || q.includes("join")) {
    return (
      "To join a live draw: On web, click Join or use a live link. On app, go to Join Live Draw and enter the 6-digit room code. Organizers can start a live draw from the wheel screen; the code shows at the top."
    )
  }
  if (q.includes("live") || q.includes("broadcast") || q.includes("stream")) {
    return (
      "Live draw: Organizer opens a wheel and taps Start Live Draw to generate a 6-digit room code. Participants enter that code on web or app to watch and chat in real time."
    )
  }
  if (q.includes("announcement") || q.includes("notify") || q.includes("notice")) {
    return (
      "Announcements: Admin can send announcements in the Admin Dashboard. Participants and organizers will see a pop-up after login and a bell indicator in their dashboards."
    )
  }
  if (q.includes("wheel") || q.includes("picker") || q.includes("spin")) {
    return (
      "Create or use a wheel: Go to the Picker Wheels gallery to pick a wheel, or open a saved wheel to spin. You can set the number of winners and customize themes."
    )
  }
  if (q.includes("team")) {
    return (
      "Team Picker: Add your list of names, then choose number of groups or group size, and generate random teams equally."
    )
  }
  if (q.includes("history") || q.includes("results")) {
    return (
      "Spin History: View recent winners/results from the History/Spin History screens in the organizer/participant dashboards or the wheel screen."
    )
  }
  if (q.includes("theme") || q.includes("color") || q.includes("customize")) {
    return (
      "Theme & Colors: Open Settings → Customize Theme. You can change primary/secondary colors and background."
    )
  }
  if (q.includes("invite") || q.includes("kick") || q.includes("moderate") || q.includes("chat")) {
    return (
      "Live moderation: Organizer can invite users by room code and manage participants. Live chat appears in the room; the organizer can remove disruptive viewers from the live session."
    )
  }
  return (
    "Hi! I'm Coby. I can help you find features like Live Draw, Room Codes, Announcements, Team Picker, Wheel Settings, and Spin History. Try asking things like ‘How do I start a live draw?’ or ‘Where is the room code?’"
  )
}

export function CobyAssistant() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi, I'm Coby. How can I help you today?" },
  ])
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, open])

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    const answer = routeQueryToAnswer(text)
    setMessages((prev) => [...prev, { role: "user", content: text }, { role: "assistant", content: answer }])
    setInput("")
  }

  const quickTips = useMemo(
    () => [
      { label: "Start Live Draw", q: "How do I start a live draw?" },
      { label: "Join by Code", q: "Where do I enter the room code?" },
      { label: "Team Picker", q: "How do I split names into teams?" },
      { label: "Announcements", q: "How do announcements show after login?" },
      { label: "Customize Theme", q: "How do I change theme colors?" },
    ],
    []
  )

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button onClick={() => setOpen(true)} className="rounded-full h-12 w-12 p-0 shadow-lg" aria-label="Open Coby assistant">
          <MessageCircle className="h-5 w-5" />
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Coby Assistant</DialogTitle>
          </DialogHeader>

          <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === "assistant" ? "text-sm" : "text-sm text-right"}>
                <Card className={`inline-block px-3 py-2 ${m.role === "assistant" ? "bg-white" : "bg-slate-50"}`}>
                  {m.content}
                </Card>
              </div>
            ))}
            <div ref={endRef} />
            <div className="pt-2">
              <div className="text-xs text-muted-foreground mb-2">Quick tips</div>
              <div className="flex flex-wrap gap-2">
                {quickTips.map((tip) => (
                  <Button key={tip.label} size="sm" variant="outline" onClick={() => {
                    const answer = routeQueryToAnswer(tip.q)
                    setMessages(prev => [...prev, { role: "user", content: tip.q }, { role: "assistant", content: answer }])
                  }}>{tip.label}</Button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-4 border-t flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Coby anything…"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
            />
            <Button onClick={handleSend}>Send</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
