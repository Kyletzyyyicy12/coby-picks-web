# BYTEROVER HANDBOOK - CobyPicks Interactive Wheel System

## Layer 1: System Overview

### Purpose
CobyPicks is a comprehensive interactive wheel system designed for educators and event organizers worldwide. It provides real-time collaborative wheel spinning experiences across web and mobile platforms, featuring advanced auto-spin technology, cross-platform synchronization, and enterprise-grade security.

### Tech Stack
- **Frontend Web**: Next.js 14, React 18, TypeScript, Tailwind CSS, Radix UI
- **Mobile**: React Native, Expo SDK, TypeScript
- **Backend**: Firebase (Firestore, Auth, Cloud Functions)
- **Real-time**: Firebase Realtime Database, Firestore listeners
- **UI Components**: Radix UI, Lucide React icons
- **State Management**: React hooks, Firebase real-time listeners

### Architecture
- **Multi-platform Architecture**: Separate web (Next.js) and mobile (Expo) applications sharing Firebase backend
- **Real-time Synchronization**: Firebase-powered cross-platform data sync
- **Component-based Design**: Modular React components with TypeScript
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Authentication**: Firebase Auth with role-based access control

### Key Features
- Real-time collaborative wheel sessions
- Auto-spin technology with customizable intervals
- Cross-platform synchronization
- Live participant tracking
- Admin dashboard with analytics
- Image-based wheel customization
- Enterprise security and permissions

## Layer 2: Module Map

### Core Modules

#### Web Application (`web1/`)
- **Components**: Reusable UI components (`components/`)
  - `admin/`: Admin dashboard and management components
  - `auth/`: Authentication components and forms
  - `dashboard/`: Admin and organizer interfaces
  - `dashboards/`: Specialized dashboard views (student, teacher, organizer)
  - `data/`: Data import and management components
  - `debug/`: Debugging and testing utilities
  - `landing/`: Landing page components
  - `live/`: Real-time session management and participant synchronization
  - `mobile/`: Mobile-specific components
  - `organizer/`: Live room organizer controls and session management
  - `participant/`: Participant views and join functionality
  - `picker-wheels/`: Wheel gallery and creation components
  - `privacy/`: Privacy and consent management
  - `randomizer/`: Wheel spinning logic and animation
  - `shared/`: Common components like announcements, winner popups, and creators
  - `student/`: Student-specific views and components
  - `teacher/`: Teacher dashboard and management tools
  - `team/`: Team collaboration components
  - `test/`: Testing and integration components
  - `ui/`: Reusable UI component library
  - `utility/`: Utility and helper components
  - `wheel/`: Core wheel components (coby-picks-wheel.tsx)
  - `wheels/`: Specialized wheel types (ImagePickerWheel.tsx)
- **Pages**: Next.js app router pages (`app/`)
  - Activity management, live sessions, admin panels
- **Libraries**: Utility functions and types (`lib/`, `types/`)
  - `picker-wheel-types.ts`: Wheel configuration and type definitions

#### Mobile Application (`app/`)
- **Screens**: React Native screens (`src/screens/`)
- **Components**: Mobile-specific components (`src/components/`)
- **Services**: Firebase integration (`src/services/`)
- **Navigation**: React Navigation setup (`src/navigation/`)

#### Shared Infrastructure
- **Firebase**: Backend services (Auth, Firestore, Functions)
- **Configuration**: Firebase config, environment setup
- **Assets**: Images, fonts, icons

### Module Responsibilities
- **Authentication**: User login/signup, role management
- **Session Management**: Live wheel sessions, participant handling
- **Wheel Engine**: Spinning logic, randomization algorithms
- **Real-time Sync**: Cross-platform data synchronization
- **Admin Controls**: Dashboard, analytics, user management
- **Announcement System**: In-app notifications and messaging

## Layer 3: Integration Guide

### APIs and Interfaces

#### Firebase Integration
- **Firestore Collections**:
  - `activities`: Wheel activities and configurations
  - `sessions`: Live session data and participant management
  - `users`: User profiles and roles
  - `announcements`: System notifications and winner announcements
  - `liveDrawSessions`: Real-time live session state and wheel synchronization
  - `spinHistory`: Historical spin results and analytics
- **Authentication**: Firebase Auth for login/logout
- **Real-time Listeners**: Firestore onSnapshot for live updates and synchronization

#### Wheel Spinning System
- **Core Components**:
  - `coby-picks-wheel.tsx`: Main wheel component with spinning animation
  - `enhanced-wheel.tsx`: Advanced wheel with real-time synchronization
  - `ImagePickerWheel.tsx`: Image-based wheel with participant sync
- **Spinning Mechanics**:
  - Configurable spin duration and speed levels
  - Random winner selection with visual feedback
  - Manual stop option for controlled spins
  - Mystery spin mode (hides items during spin)
  - Sound effects and confetti animations

#### Component Interfaces
- **Wheel Components**: Props for customization, event handlers, spinning controls
- **Session Managers**: Participant joining, real-time updates, synchronization
- **Dashboard Components**: Data display, admin controls, analytics
- **Winner Announcement**: Popup components for winner display and celebration

#### Real-time Synchronization System
- **Live Session Management**: Organizer controls with participant synchronization
- **Wheel State Broadcasting**: Firebase-powered instant wheel state updates
- **Participant Sync**: Automatic spinning animation for all participants
- **Winner Announcement**: Coordinated winner reveal across all connected users
- **Reaction System**: Live participant reactions and feedback during spins

#### External Services
- **Expo Services**: Push notifications, device features
- **Image Handling**: Expo Image Picker, file system
- **QR Code Generation**: For session sharing

### Configuration Files
- `firebase.json`: Firebase project configuration
- `app.json`: Expo app configuration
- `tailwind.config.js`: Styling configuration
- `components.json`: UI component configuration

## Layer 4: Extension Points

### Design Patterns
- **Component Composition**: Higher-order components for shared logic
- **Custom Hooks**: Reusable stateful logic (useAuth, useSession)
- **Provider Pattern**: Context providers for global state
- **Factory Pattern**: Wheel type creation and management

### Customization Areas
- **Wheel Types**: Extensible wheel configurations (`lib/picker-wheel-types.ts`)
- **Spin Settings**: Configurable duration, speed, mystery mode, manual stop
- **Themes**: Customizable color schemes and branding
- **UI Components**: Radix UI primitives for consistent design
- **Animation Effects**: Canvas confetti, smooth transitions, sound effects
- **Winner Display**: Customizable winner announcement popups and celebrations

### Extension Points
- **Plugin System**: Modular feature additions
- **API Extensions**: Custom Firebase functions
- **Component Library**: Reusable UI components
- **Configuration Overrides**: Environment-specific settings

### Development Workflow
- **Hot Reload**: Next.js and Expo development servers
- **TypeScript**: Type-safe development across platforms
- **ESLint**: Code quality and consistency
- **Firebase Emulators**: Local development and testing

---

*This handbook provides navigation guidance for the CobyPicks Interactive Wheel System. Last updated: 2025*