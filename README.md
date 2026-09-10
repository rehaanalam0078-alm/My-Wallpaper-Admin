# MyWallpaper Studio — Admin Panel

A modern, production-ready admin panel for managing the **MyWallpaper** platform, built with React, Vite, Tailwind CSS, Firebase (Auth + Firestore), and Cloudinary.

![Dashboard Preview](https://raw.githubusercontent.com/rehaanalam0078-alm/My-Wallpaper-Admin/main/preview.png)

## ✨ Features

- **📊 Live Analytics Dashboard**: Dynamic real-time statistics aggregating all wallpapers, active categories, bandwidth, and category metrics directly from Cloud Firestore.
- **⚡ Bulk Upload Studio**: Concurrent multi-file drag-and-drop uploader with real-time progress indicators, category assignment, and direct unsigned uploads to Cloudinary.
- **📱 Mobile Mockup Wallpaper Library**: Visual preview cards simulating 9:16 mobile device frames, with search, category filtering, pagination, and slide-out inspector drawer.
- **🏷️ Category Normalization & Management**: Centralized normalization engine reconciling legacy tags and typos (`ainme` → `anime`, `hindusim` → `hinduism`) while strictly preserving existing Android app Firestore schemas (`{ imageUrl, category }`).
- **🔐 Firebase Authentication**: Protected route guards and administrator session handling.
- **🎨 Stitch Dark Theme System**: Sleek glassmorphism, glowing accents, Inter & JetBrains Mono typography, and custom in-app toast notification system.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, Google Material Symbols
- **Backend & Database**: Firebase Authentication, Google Cloud Firestore
- **Media CDN**: Cloudinary unsigned upload preset (`wallpaper_upload`)
- **Routing**: React Router v7

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/rehaanalam0078-alm/My-Wallpaper-Admin.git

# Navigate into directory
cd My-Wallpaper-Admin

# Install dependencies
npm install

# Start local development server
npm run dev
```

The application will be available at `http://localhost:5173/`.

### Production Build

```bash
npm run build
npm run preview
```

## 🔒 Environment & Configuration

Firebase and Cloudinary client configs are configured in `src/firebase.js` and `src/services/cloudinaryService.js`.
No private server keys or secrets are bundled in the client code.

## 📄 License

This project is proprietary and built for MyWallpaper Studio.
