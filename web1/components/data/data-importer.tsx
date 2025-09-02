"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { db } from "@/lib/firebase"
import { collection, writeBatch, query, getDocs, doc } from "firebase/firestore"
import { toast } from "@/hooks/use-toast"
import Papa from "papaparse"
import { Loader2 } from "lucide-react"

interface DataImporterProps {
  wheelId: string
}

export function DataImporter({ wheelId }: DataImporterProps) {
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [data, setData] = useState<Record<string, string>[]>([])
  const [loading, setLoading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      parseFile(selectedFile)
    }
  }

  const parseFile = (file: File) => {
    setLoading(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setHeaders(results.meta.fields || [])
        setData(results.data as Record<string, string>[])
        setLoading(false)
        toast({
          title: "File Parsed",
          description: `${results.data.length} rows found.`,
        })
      },
      error: (error) => {
        setLoading(false)
        toast({
          title: "Error Parsing File",
          description: error.message,
          variant: "destructive",
        })
      },
    })
  }

  const handleUploadToFirebase = async () => {
    if (!wheelId || data.length === 0) {
      toast({
        title: "No Data to Upload",
        description: "Please select and parse a file first.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const participantsCollectionRef = collection(db, `wheels/${wheelId}/participants`)

      // Clear existing participants for this wheel
      const existingParticipantsQuery = query(participantsCollectionRef)
      const existingParticipantsSnapshot = await getDocs(existingParticipantsQuery)
      const batch = writeBatch(db)
      existingParticipantsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref)
      })
      await batch.commit()

      // Add new participants
      const newParticipantsBatch = writeBatch(db)
      data.forEach((row) => {
        const participantData: Record<string, string | undefined> = {
          name: row.name || row[headers[0]] || "Unnamed Participant", // Use 'name' column or first column as default
          email: row.email,
          contactNumber: row["contact number"] || row.contact, // Handle common variations
          originalHeaders: row, // Store all original data
        }
        newParticipantsBatch.set(doc(participantsCollectionRef), participantData)
      })
      await newParticipantsBatch.commit()

      toast({
        title: "Participants Uploaded",
        description: `${data.length} participants successfully added to the wheel.`,
      })
      setFile(null)
      setHeaders([])
      setData([])
    } catch (error: any) {
      toast({
        title: "Error Uploading Data",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="data-file">Upload Participants (CSV)</Label>
        <Input id="data-file" type="file" accept=".csv" onChange={handleFileChange} />
        <p className="text-sm text-muted-foreground">
          Upload a CSV file. Ensure one column is for names (e.g., "name"). Other columns like "email", "contact number"
          will also be imported. For Excel (.xlsx) support, a dedicated library like `xlsx` would be required.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-swu-red" />
          Parsing file...
        </div>
      )}

      {data.length > 0 && (
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                {headers.slice(0, 3).map((header) => (
                  <TableHead key={header}>{header}</TableHead>
                ))}
                {headers.length > 3 && <TableHead>...</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 5).map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {headers.slice(0, 3).map((header) => (
                    <TableCell key={`${rowIndex}-${header}`}>{row[header]}</TableCell>
                  ))}
                  {headers.length > 3 && <TableCell>...</TableCell>}
                </TableRow>
              ))}
              {data.length > 5 && (
                <TableRow>
                  <TableCell
                    colSpan={headers.length > 3 ? 4 : headers.length}
                    className="text-center text-muted-foreground"
                  >
                    ... {data.length - 5} more rows
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="p-4 text-sm text-muted-foreground border-t border-gray-200">Total rows: {data.length}</div>
        </div>
      )}

      <Button
        onClick={handleUploadToFirebase}
        disabled={!file || loading || data.length === 0}
        className="bg-swu-red hover:bg-swu-red/90 text-white"
      >
        {loading ? "Uploading..." : "Upload to Wheel"}
      </Button>
    </div>
  )
}
