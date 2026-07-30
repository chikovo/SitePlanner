# SitePlanner

A construction site management platform built with vanilla HTML, CSS, and JavaScript, backed by Firebase (Firestore, Auth, Storage).

## Features

- 🗺️ **Interactive Masterplan** — Upload your compound image and place unit hotspots on it
- 📋 **Unit Management** — Track 100+ units with status, phase, engineer assignment, and contractor info
- 📊 **Dashboard** — Real-time progress overview, phase breakdown, engineer workload, and activity feed
- 📸 **Photos & Drawings** — Per-unit photo gallery and drawing revision management
- 💬 **Comments & Issues** — Site notes and flagged issues per unit
- 🔐 **Role-Based Access** — Manager, Engineer, and Viewer roles
- ✅ **Engineer Handover** — Track formal sign-off per unit

## Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Backend:** Firebase (Firestore, Authentication, Storage)
- **No build step required** — runs directly in the browser

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/chikovo/SitePlanner.git
cd SitePlanner
```

### 2. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com) and create a new project
2. Enable **Authentication** (Email/Password)
3. Enable **Firestore Database**
4. Enable **Storage**
5. Copy your project credentials into `firebase-config.js`:

```js
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

### 3. Run locally

Serve the project with any static HTTP server. Using Python:

```bash
python -m http.server 3333
```

Then open [http://localhost:3333](http://localhost:3333)

### Demo Mode (no Firebase required)

Open `demo.html` instead of `index.html` for a fully self-contained demo with 109 pre-digitized units and mock data — no Firebase setup needed.

```bash
python -m http.server 3333
# Then open: http://localhost:3333/demo.html
```

## Project Structure

```
SitePlanner/
├── index.html          # Main app entry point
├── app.js              # Core application logic
├── styles.css          # All styles
├── firebase-config.js  # Firebase credentials (fill in your own)
├── demo.html           # Standalone demo (no Firebase required)
├── masterplan-data.js  # Digitized unit positions (109 units)
└── masterplan.jpg      # Your compound masterplan image (not tracked)
```

## Masterplan Setup

1. Place your compound image as `masterplan.jpg` in the project root
2. Open the app and go to the **Map** view
3. Upload your image via the map panel
4. Use the admin panel to set hotspot coordinates per unit

The `masterplan-data.js` file contains pre-digitized coordinates for 109 units across the compound (AP01–AP08 apartment blocks, 68 villas in 5 zones, 34 townhouses).

## License

MIT
