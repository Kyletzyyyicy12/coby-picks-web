# Live Session Dashboard Improvements

## 🎯 Problem Solved
The user requested: "*make sure when the live room isn't end session it can reflect the live room that the organizer make on the recent activity*"

**Solution**: Enhanced the organizer dashboard to detect and display active live sessions, allowing organizers to resume their ongoing sessions directly from the dashboard.

## ✅ Improvements Made

### 1. Enhanced `DrawActivity` Interface
**File**: `components/dashboards/organizer-dashboard.tsx`

Added live session properties to track active sessions:
```typescript
interface DrawActivity {
  // ... existing properties
  // Live session properties
  liveSessionId?: string
  hasActiveSession?: boolean
  sessionData?: {
    roomCode: string
    viewerCount: number
    currentState: string
    createdAt: Date
  } | null
}
```

### 2. Live Session Detection Logic
Enhanced `fetchDashboardData()` function to check for active live sessions:

```typescript
// Check for active live sessions for each activity
const activitiesWithLiveStatus = await Promise.all(
  activities.map(async (activity) => {
    if (activity.liveSessionId) {
      try {
        const sessionDoc = await getDoc(doc(db, "liveDrawSessions", activity.liveSessionId))
        if (sessionDoc.exists()) {
          const sessionData = sessionDoc.data()
          const isSessionActive = sessionData.isActive && sessionData.isLive
          
          return {
            ...activity,
            hasActiveSession: isSessionActive,
            sessionData: isSessionActive ? {
              roomCode: sessionData.roomCode,
              viewerCount: sessionData.viewerCount || 0,
              currentState: sessionData.currentState || 'waiting',
              createdAt: sessionData.createdAt?.toDate() || new Date()
            } : null
          }
        }
      } catch (error) {
        console.log(`❌ Error checking live session for activity ${activity.id}:`, error)
      }
    }
    
    return {
      ...activity,
      hasActiveSession: false,
      sessionData: null
    }
  })
)
```

### 3. Enhanced Dashboard Stats
Added `activeLiveSessions` count to dashboard statistics:

```typescript
interface DashboardStats {
  activeWheels: number
  totalDraws: number
  lastWinner: string
  totalParticipants: number
  activeLiveSessions: number // NEW
}

// Calculate active live sessions
const activeLiveSessions = activitiesWithLiveStatus.filter(activity => activity.hasActiveSession).length
```

### 4. Stats Overview Section
Added a comprehensive stats overview with visual indicators:

- **🔴 Live Sessions**: Highlighted in red when active sessions exist
- **🎯 Active Wheels**: Shows recently used wheels (last 7 days)
- **🏆 Total Draws**: Cumulative draw count across all activities
- **👥 Total Participants**: Total participant count

### 5. Enhanced Activity Cards
**Live Session Status Indicators**:
- **🔴 LIVE Badge**: Visual indicator for activities with active sessions
- **Live Session Info Panel**: Shows room code, viewer count, and current state
- **Resume Live Session Button**: Red button to reconnect to active sessions

**Code Example**:
```tsx
{/* Live Session Status Badge */}
{activity.hasActiveSession && activity.sessionData && (
  <Badge variant="outline" className="text-xs bg-red-50 border-red-500 text-red-600">
    🔴 LIVE
  </Badge>
)}

{/* Live Session Info Panel */}
{activity.hasActiveSession && activity.sessionData && (
  <div className="bg-red-50 border border-red-200 rounded p-2 mt-2">
    <div className="text-xs text-red-700 space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-semibold">🏠 Room Code:</span>
        <span className="bg-white px-2 py-1 rounded font-mono">
          {activity.sessionData.roomCode}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold">👥 Viewers:</span>
        <span>{activity.sessionData.viewerCount}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold">📊 Status:</span>
        <span className="capitalize">{activity.sessionData.currentState}</span>
      </div>
    </div>
  </div>
)}
```

### 6. Smart Button Logic
**Resume vs Start Draw**:
- Shows **"Resume Live Session"** (red button) for activities with active sessions
- Shows **"Start Draw"** (normal button) for activities without active sessions
- Proper navigation to existing live sessions vs creating new ones

```tsx
{activity.hasActiveSession && activity.sessionData ? (
  <Button
    size="sm"
    className="flex-1 text-white bg-red-600 hover:bg-red-700"
    onClick={() => {
      // Navigate directly to the existing live session
      const targetUrl = `/live/${activity.liveSessionId}`
      window.location.href = targetUrl
    }}
  >
    <Play className="h-4 w-4 mr-1" />
    Resume Live Session
  </Button>
) : (
  <Button
    size="sm"
    className="flex-1 text-white"
    style={{ backgroundColor: schoolColors.primary }}
    onClick={() => {
      // Start new activity/session
      const targetUrl = `/live/${activity.id}`
      window.location.href = targetUrl
    }}
  >
    <Play className="h-4 w-4 mr-1" />
    Start Draw
  </Button>
)}
```

### 7. Recent Activities Header Enhancement
Added live session counter in the section header:
```tsx
<div className="flex items-center gap-4">
  <h2 className="text-2xl font-bold">📝 Recent Draw Activities</h2>
  {stats.activeLiveSessions > 0 && (
    <Badge className="bg-red-100 border-red-500 text-red-600">
      🔴 {stats.activeLiveSessions} Live Session{stats.activeLiveSessions > 1 ? 's' : ''}
    </Badge>
  )}
</div>
```

## 🚀 Result
Now when organizers visit their dashboard, they can:

1. **See Live Session Stats**: Overview section shows active live sessions count
2. **Identify Active Sessions**: Activities with live sessions have clear visual indicators
3. **View Session Details**: Room codes, viewer counts, and session status
4. **Resume Sessions**: One-click access to resume active live sessions
5. **Prevent Duplication**: Avoid creating new sessions when one is already active

## 📱 User Experience Flow
1. Organizer opens dashboard
2. Sees overview stats including active live sessions
3. Identifies activities with 🔴 LIVE badges
4. Clicks "Resume Live Session" to reconnect
5. Continues managing their live session from where they left off

## 🔧 Technical Implementation
- **Database Queries**: Efficiently checks live session status for each activity
- **Real-time Data**: Shows current viewer counts and session states
- **Error Handling**: Graceful fallbacks when session data is unavailable
- **Performance**: Parallel session checks to minimize loading time
- **Navigation**: Proper routing to existing vs new sessions

The organizer dashboard now provides complete visibility and control over live sessions, ensuring no active sessions are lost or forgotten!