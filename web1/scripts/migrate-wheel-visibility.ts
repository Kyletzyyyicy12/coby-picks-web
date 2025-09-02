/**
 * Migration Script: Wheel Type Visibility Control
 * 
 * This script updates existing wheel types in Firestore to hide specific wheel types
 * from new organizers and participants as requested by the user.
 * 
 * Wheel types to be hidden:
 * - yes-no-picker
 * - number-picker
 * - country-picker
 * - color-picker
 * - image-picker
 * - date-picker
 * - instagram-comment-picker
 * - mlb-picker
 * - nba-picker
 * - nfl-picker
 */

import { db } from "../lib/firebase"
import { collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore"

// Wheel types that should be hidden for new users
const WHEEL_TYPES_TO_HIDE = [
  "yes-no-picker",
  "number-picker", 
  "country-picker",
  "color-picker",
  "image-picker",
  "date-picker",
  "instagram-comment-picker",
  "mlb-picker",
  "nba-picker",
  "nfl-picker"
]

export async function migrateWheelVisibility() {
  try {
    console.log("🔄 Starting wheel type visibility migration...")
    
    // Get all wheel types from Firestore
    const wheelTypesQuery = query(collection(db, "wheelTypes"))
    const querySnapshot = await getDocs(wheelTypesQuery)
    
    let updatedCount = 0
    let skippedCount = 0
    
    for (const docSnap of querySnapshot.docs) {
      const wheelType = docSnap.data()
      const wheelTypeValue = wheelType.value
      
      // Check if this wheel type should be hidden
      const shouldBeHidden = WHEEL_TYPES_TO_HIDE.includes(wheelTypeValue)
      
      // Only update if the current hiddenForNewUsers status doesn't match what it should be
      const currentHiddenStatus = wheelType.hiddenForNewUsers || false
      
      if (shouldBeHidden !== currentHiddenStatus) {
        await updateDoc(doc(db, "wheelTypes", docSnap.id), {
          hiddenForNewUsers: shouldBeHidden,
          updatedAt: new Date()
        })
        
        console.log(`✅ Updated "${wheelType.label}" (${wheelTypeValue}): hiddenForNewUsers = ${shouldBeHidden}`)
        updatedCount++
      } else {
        console.log(`⏭️ Skipped "${wheelType.label}" (${wheelTypeValue}): already correct`)
        skippedCount++
      }
    }
    
    console.log(`🎉 Migration completed!`)
    console.log(`📊 Statistics:`)
    console.log(`   - Updated: ${updatedCount} wheel types`)
    console.log(`   - Skipped: ${skippedCount} wheel types`)
    console.log(`   - Total: ${querySnapshot.docs.length} wheel types processed`)
    
    return {
      success: true,
      updated: updatedCount,
      skipped: skippedCount,
      total: querySnapshot.docs.length
    }
    
  } catch (error) {
    console.error("❌ Error during migration:", error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Auto-run migration if this script is executed directly
if (typeof window !== 'undefined') {
  console.log("⚠️ Migration script detected in browser environment")
  console.log("💡 Call migrateWheelVisibility() manually from browser console if needed")
}