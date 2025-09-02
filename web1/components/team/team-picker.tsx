"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Download, UploadCloud, Shuffle, Users, Fullscreen, Minimize2, Save, Share2, Wand2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged, type User } from "firebase/auth"
import { collection, addDoc } from "firebase/firestore"

interface Person {
  id: string
  name: string
  gender?: "M" | "F"
  label?: string
}

interface TeamPickerProps {
  initialNames?: string[]
}

export const TeamPicker: React.FC<TeamPickerProps> = ({ initialNames = [] }) => {
  const [user, setUser] = useState<User | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [newName, setNewName] = useState("")
  const [newGender, setNewGender] = useState<"M" | "F" | "none">("none")
  const [newLabel, setNewLabel] = useState("")

  const [mode, setMode] = useState<"default" | "gender" | "label">("default")
  const [groupingBy, setGroupingBy] = useState<"groups" | "size">("groups")
  const [numGroups, setNumGroups] = useState(2)
  const [groupSize, setGroupSize] = useState(0)
  const [pickRepresentative, setPickRepresentative] = useState(false)
  const [showIcons, setShowIcons] = useState(true)

  const [teamNames, setTeamNames] = useState<string[]>([])
  const [keepTogether, setKeepTogether] = useState<string>("") // comma separated names that must be together
  const [separateList, setSeparateList] = useState<string>("") // comma separated names that must be separated

  const [teams, setTeams] = useState<Person[][]>([])
  const [full, setFull] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser)
    return () => unsub()
  }, [])

  useEffect(() => {
    if (initialNames.length > 0 && people.length === 0) {
      setPeople(initialNames.map((n, i) => ({ id: `p-${i}`, name: n })))
    }
  }, [initialNames])

  const addPerson = () => {
    const name = newName.trim()
    if (!name) return
    if (people.find(p => p.name.toLowerCase() === name.toLowerCase())) {
      toast({ title: "Duplicate", description: "This name already exists", variant: "destructive" })
      return
    }
    setPeople(prev => [...prev, { id: `p-${Date.now()}`, name, gender: newGender === "none" ? undefined : newGender as "M" | "F" | undefined, label: newLabel || undefined }])
    setNewName("")
    setNewGender("none")
    setNewLabel("")
  }

  const importCSV = async (file: File) => {
    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      const imported: Person[] = []
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i]
        const parts = raw.split(",")
        const name = parts[0]?.trim()
        const gender = (parts[1]?.trim().toUpperCase() as any) || undefined
        const label = parts[2]?.trim() || undefined
        if (name) imported.push({ id: `i-${Date.now()}-${i}`, name, gender: gender === 'M' || gender === 'F' ? gender : undefined, label })
      }
      if (imported.length === 0) {
        toast({ title: "No names found", description: "Ensure your CSV has lines like: Name,Gender(M/F),Label" })
        return
      }
      setPeople(prev => [...prev, ...imported])
      toast({ title: "Imported", description: `${imported.length} names added` })
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" })
    }
  }

  const shuffle = <T,>(arr: T[]) => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const applyConstraints = (arr: Person[]) => {
    let pool = [...arr]
    const keepSets = keepTogether.split(/;/).map(s => s.split(/,/).map(x => x.trim()).filter(Boolean)).filter(g => g.length > 0)
    const separateNames = new Set(separateList.split(/,/).map(s => s.trim()).filter(Boolean))

    // Merge keep-together as units
    const grouped: (Person | Person[])[] = []
    const used = new Set<string>()
    for (const group of keepSets) {
      const unit = pool.filter(p => group.some(n => n.toLowerCase() === p.name.toLowerCase()))
      unit.forEach(p => used.add(p.id))
      if (unit.length > 0) grouped.push(unit)
    }
    for (const p of pool) if (!used.has(p.id)) grouped.push(p)

    return { grouped, separateNames }
  }

  const generateTeams = () => {
    const capGroups = Math.min(100, Math.max(1, groupingBy === 'groups' ? numGroups : Math.ceil(people.length / Math.max(1, groupSize))))
    if (capGroups < 1) return
    let base = shuffle(people)

    // Constraints
    const { grouped, separateNames } = applyConstraints(base)

    // Distribution
    let buckets: Person[][] = Array.from({ length: capGroups }, () => [])

    if (mode === 'gender') {
      const males = shuffle(base.filter(p => p.gender === 'M'))
      const females = shuffle(base.filter(p => p.gender === 'F'))
      let i = 0
      for (const m of males) { buckets[i % capGroups].push(m); i++ }
      for (const f of females) { buckets[i % capGroups].push(f); i++ }
    } else if (mode === 'label') {
      const byLabel: Record<string, Person[]> = {}
      for (const p of base) {
        const key = p.label || 'other'
        byLabel[key] = byLabel[key] || []
        byLabel[key].push(p)
      }
      let i = 0
      Object.values(byLabel).forEach(list => {
        shuffle(list).forEach(p => { buckets[i % capGroups].push(p); i++ })
      })
    } else {
      // default random with keep-together units distributed round-robin
      let i = 0
      for (const unit of grouped) {
        if (Array.isArray(unit)) {
          for (const p of unit) {
            buckets[i % capGroups].push(p); i++
          }
        } else {
          buckets[i % capGroups].push(unit); i++
        }
      }
    }

    // Enforce separation: if any bucket contains 2 from separateNames, try simple swap
    for (let b = 0; b < buckets.length; b++) {
      const names = buckets[b].map(p => p.name.toLowerCase())
      const conflicts = buckets[b].filter(p => separateNames.has(p.name))
      if (conflicts.length > 1) {
        // Move extras to next buckets
        for (let k = 1; k < conflicts.length; k++) {
          const p = conflicts[k]
          // find target bucket where no conflict name exists
          let moved = false
          for (let t = 0; t < buckets.length; t++) {
            if (t === b) continue
            if (!buckets[t].some(x => separateNames.has(x.name))) {
              buckets[b] = buckets[b].filter(x => x.id !== p.id)
              buckets[t].push(p)
              moved = true
              break
            }
          }
          if (!moved) {
            // fallback: just move to next
            const t = (b + 1) % buckets.length
            buckets[b] = buckets[b].filter(x => x.id !== p.id)
            buckets[t].push(p)
          }
        }
      }
    }

    setTeams(buckets)
    // Initialize team names if needed
    if (teamNames.length !== buckets.length) {
      setTeamNames(Array.from({ length: buckets.length }, (_, i) => `Team ${i + 1}`))
    }
  }

  const exportCSV = () => {
    const rows: string[] = []
    teams.forEach((t, i) => {
      rows.push(`${teamNames[i]}`)
      t.forEach(p => rows.push(`${p.name},${p.gender || ''},${p.label || ''}`))
      rows.push("")
    })
    const blob = new Blob([rows.join("\n")], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `teams-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: "Exported", description: "Teams exported as CSV" })
  }

  const exportImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const width = 900
    const rowHeight = 26
    let lines = 2 // padding
    teams.forEach((t) => { lines += 2 + t.length })
    const height = Math.max(300, 20 + lines * rowHeight)
    canvas.width = width
    canvas.height = height
    // bg
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 20px sans-serif'
    ctx.fillText('Team Picker Results', 20, 30)
    let y = 60
    teams.forEach((t, i) => {
      ctx.font = 'bold 18px sans-serif'
      ctx.fillStyle = '#8e0b16'
      ctx.fillText(teamNames[i], 20, y)
      y += rowHeight
      ctx.font = '14px sans-serif'
      ctx.fillStyle = '#111827'
      if (pickRepresentative && t[0]) {
        ctx.fillText(`Rep: ${t[0].name}`, 40, y)
        y += rowHeight
      }
      t.forEach((p) => {
        const icon = p.gender ? (p.gender === 'M' ? '♂' : '♀') : (p.label ? `(${p.label})` : '')
        ctx.fillText(`- ${p.name} ${icon}`, 40, y)
        y += rowHeight
      })
      y += rowHeight
    })
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `teams-${Date.now()}.png`
    a.click()
    toast({ title: "Saved image", description: "Download started" })
  }

  const shareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast({ title: "Link Copied", description: "Share this page link" })
      if ((navigator as any).share) {
        await (navigator as any).share({ title: 'Team Picker', text: 'Check my team results', url: window.location.href })
      }
    } catch {}
  }

  const saveListLocally = () => {
    const key = 'teampicker_lists'
    const current = JSON.parse(localStorage.getItem(key) || '[]') as Array<{ name: string; people: Person[] }>
    if (current.length >= 5) {
      current.shift()
    }
    current.push({ name: `List ${Date.now()}`, people })
    localStorage.setItem(key, JSON.stringify(current))
    toast({ title: "Saved locally", description: "List saved (max 5 kept)" })
  }

  const saveListToCloud = async () => {
    if (!user) { toast({ title: "Login required", description: "Sign in to save to cloud", variant: "destructive" }); return }
    try {
      await addDoc(collection(db, 'teamLists'), { userId: user.uid, createdAt: new Date(), people })
      toast({ title: "Saved to cloud", description: "Team list stored" })
    } catch (e: any) {
      toast({ title: "Cloud save failed", description: e.message, variant: "destructive" })
    }
  }

  const toggleFull = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.()
      setFull(true)
    } else {
      document.exitFullscreen?.()
      setFull(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type.includes('csv') && !f.name.toLowerCase().endsWith('.csv')) {
      toast({ title: 'Invalid file', description: 'Upload a .csv file', variant: 'destructive' })
      return
    }
    importCSV(f)
    e.currentTarget.value = ''
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Team Picker Wheel – Randomize a List of Names into Groups</CardTitle>
          <CardDescription>
            Split names into equal groups, pairs, or custom sizes. Balance by gender or labels. Export results and save your lists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input methods */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Add Name</Label>
              <div className="flex gap-2">
                <Input placeholder="Full name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Select value={newGender} onValueChange={(v: any) => setNewGender(v)}>
                  <SelectTrigger className="w-[110px]"><SelectValue placeholder="Gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Label (e.g. Dept)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} className="w-[150px]" />
                <Button onClick={addPerson}><UploadCloud className="h-4 w-4 mr-1" />Add</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Import from CSV</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept=".csv" onChange={handleFileChange} />
                <Button variant="outline" onClick={() => {
                  const example = 'Name,Gender(M/F),Label\nAlice,F,Blue\nBob,M,Red\nCarol,F,Blue'
                  const blob = new Blob([example], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'team-picker-example.csv'
                  a.click()
                  URL.revokeObjectURL(url)
                }}>Sample</Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Distribution & settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Distribution Mode</Label>
              <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default – random grouping</SelectItem>
                  <SelectItem value="gender">Gender – balance male/female</SelectItem>
                  <SelectItem value="label">Label – balance custom labels</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Distribution Target</Label>
              <div className="flex gap-2">
                <Select value={groupingBy} onValueChange={(v: any) => setGroupingBy(v)}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="groups">Number of groups</SelectItem>
                    <SelectItem value="size">People per group</SelectItem>
                  </SelectContent>
                </Select>
                {groupingBy === 'groups' ? (
                  <Input type="number" min={1} max={100} value={numGroups} onChange={(e) => setNumGroups(Math.max(1, Math.min(100, parseInt(e.target.value || '1'))))} />
                ) : (
                  <Input type="number" min={1} value={groupSize || ''} onChange={(e) => setGroupSize(Math.max(1, parseInt(e.target.value || '1')))} />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Options</Label>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Button variant={pickRepresentative ? "default" : "outline"} size="sm" onClick={() => setPickRepresentative(v => !v)}>Pick representative</Button>
                <Button variant={showIcons ? "default" : "outline"} size="sm" onClick={() => setShowIcons(v => !v)}>Show icons</Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Preset Keep Together (use ; to separate groups, commas within a group)</Label>
              <Input placeholder="Alice,Bob; Carol,Dave" value={keepTogether} onChange={(e) => setKeepTogether(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Preset Separate (comma separated names)</Label>
              <Input placeholder="Eve, Frank" value={separateList} onChange={(e) => setSeparateList(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={generateTeams}><Shuffle className="h-4 w-4 mr-1" />Generate Teams</Button>
            <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
            <Button variant="outline" onClick={shareLink}><Share2 className="h-4 w-4 mr-1" />Share Link</Button>
            <Button variant="outline" onClick={saveListLocally}><Save className="h-4 w-4 mr-1" />Save Locally</Button>
            <Button variant="outline" onClick={saveListToCloud}><Save className="h-4 w-4 mr-1" />Save to Cloud</Button>
            <Button variant="outline" onClick={toggleFull}>{full ? <Minimize2 className="h-4 w-4 mr-1" /> : <Fullscreen className="h-4 w-4 mr-1" />}Full Screen</Button>
          </div>

          {/* People preview */}
          <div className="mt-4">
            <div className="text-sm mb-2">Participants ({people.length})</div>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => (
                <Badge key={p.id} variant="secondary" className="cursor-default">
                  {p.name}{showIcons && (p.gender ? (p.gender === 'M' ? ' ♂' : ' ♀') : p.label ? ` (${p.label})` : '')}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {teams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Teams</CardTitle>
            <CardDescription>Rename teams, review representatives, then export or share.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team, i) => (
                <div key={i} className="border rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <Input value={teamNames[i] || `Team ${i+1}`} onChange={(e) => setTeamNames(prev => { const arr = [...prev]; arr[i] = e.target.value; return arr })} />
                    {pickRepresentative && team[0] && (
                      <Badge variant="outline" className="ml-2">Rep: {team[0].name}</Badge>
                    )}
                  </div>
                  <ul className="text-sm list-disc pl-4">
                    {team.map((p, idx) => (
                      <li key={p.id}>
                        {p.name}{showIcons && (p.gender ? (p.gender === 'M' ? ' ♂' : ' ♀') : p.label ? ` (${p.label})` : '')}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={exportImage}><Download className="h-4 w-4 mr-1" />Save as Image</Button>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default TeamPicker
