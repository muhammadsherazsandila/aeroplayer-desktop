# 📽️ AeroPlayer Desktop — Premium Tauri Video Player

AeroPlayer is a state-of-the-art, high-performance local video player featuring fluid glassmorphism aesthetics, responsive drag-and-drop mechanics, and custom frameless titlebar controls.

This project is built using **Tauri v2** and **Vanilla HTML/CSS/JavaScript**, delivering a native desktop shell experience with an ultra-lightweight compiled bundle size (< 10MB) and zero performance overhead.

---

## ✨ Features

- **💎 Sleek Frameless Window**: Designed with modern glassmorphism aesthetics, fluid floating background blobs, and a fully customized titlebar drag/dock system.
- **🚀 Ultra-Fast Timeline Seeking**: Integrates Tauri's native local streaming asset protocol (`convertFileSrc`) to bypass standard CORS bottlenecks and support fluid chunked timeline scrubber skipping.
- **📂 Drag & Drop native support**: Drag any local video file directly into the player from Windows File Explorer for immediate playback.
- **⌨️ Premium Keyboard Navigation**: Full hotkey layout support:
  - `Space` to Play/Pause
  - `Left Arrow` / `Right Arrow` to skip backwards/forwards by 10 seconds (with beautiful visual HUD seek toasts)
  - `F` to toggle Fullscreen
  - `M` to toggle Mute
- **🌐 Quick Demo Streams**: Instantly stream stunning open-source demo videos like *Sintel* or *Big Buck Bunny* over the web.

---

## 🛠️ Tech Stack

- **Native Core**: [Tauri v2](https://tauri.app) (Rust shell container)
- **Frontend Layer**: Pure Vanilla HTML5, CSS3, & Modern ES6 JavaScript (No bulky bundlers or frameworks)
- **Icons**: Lucide Icons CDN
- **Fonts**: Google Fonts (Outfit & Inter)

---

## 🚀 Getting Started

### 📋 Prerequisites

To run and compile the desktop application, you need the following installed:

1. **NodeJS** (to run the Tauri CLI wrapper)
2. **Rust & Cargo** (for the native compilation). You can download and install Rust from [rustup.rs](https://rustup.rs/).
3. **C++ Build Tools**: Standard build tools required on Windows for compilation (automatically prompted by Rustup).

### 💻 Installation

1. Clone the repository and navigate into the folder:
   ```bash
   cd e:/tools/video-player
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```

### 🏃 Running in Development Mode

To start the local developer server and launch the desktop application with native hot-reload support:

```bash
npx tauri dev
```

### 📦 Building Standalone Executable

To compile a highly-optimized, single production executable / installer (located in `src-tauri/target/release`):

```bash
npx tauri build
```

---

## 📂 Project Structure

```
├── src-tauri/
│   ├── capabilities/
│   │   └── default.json       # Configured permissions for native controls
│   ├── src/
│   │   ├── lib.rs             # Rust window handlers & plugins
│   │   └── main.rs            # Application native entry point
│   ├── Cargo.toml             # Rust package configuration
│   └── tauri.conf.json        # Frameless configurations & global Tauri injection
├── src/
│   ├── index.html             # Structual player UI & quick demo links
│   ├── style.css              # Custom styled animations, CSS variables, blobs
│   ├── app.js                 # Scrubber logic, shortcuts, custom window commands
│   └── assets/                # Core brand SVGs
├── package.json               # Node dev dependencies
└── README.md                  # This guide
```
