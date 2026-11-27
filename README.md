<div align="center">
  <img src="./assets/icon.png" alt="KOMA Logo" width="88" height="88" />
  <h1>K O M A</h1>
  <p><strong>Pure <code>#000000</code> OLED Manga &amp; Manhwa Sanctuary for Windows, Android Phones &amp; Tablets</strong></p>
  <p><em>Crafted by VirtualDrum</em></p>

  <p>
    <a href="https://nourddinachi20-rgb.github.io/KOMA/">
      <img src="https://img.shields.io/badge/Official_Website-Download_KOMA-FFFFFF?style=for-the-badge&logoColor=000000" alt="Download Website" />
    </a>
    <a href="https://github.com/nourddinachi20-rgb/KOMA/releases/latest">
      <img src="https://img.shields.io/badge/Release-v1.0.0-111111?style=for-the-badge&labelColor=000000" alt="Release v1.0.0" />
    </a>
    <img src="https://img.shields.io/badge/Windows-Portable_EXE-000000?style=for-the-badge&logo=windows&logoColor=FFFFFF" alt="Windows" />
    <img src="https://img.shields.io/badge/Android-Phone_%26_Tablet_APK-000000?style=for-the-badge&logo=android&logoColor=FFFFFF" alt="Android" />
  </p>

  <h3>
    <a href="https://nourddinachi20-rgb.github.io/KOMA/">Visit the Official Download Page →</a>
  </h3>
</div>

---

## Multi-Platform Showcase (Desktop · Tablet · Phone)

<table>
  <tr>
    <td width="58%">
      <img src="./docs/screenshots/desktop-home.png" alt="KOMA Windows Desktop Home" />
      <p align="center"><sub><strong>Windows Desktop</strong> — Trending Hero Spotlight, Advance Bar &amp; Curated Shelves</sub></p>
    </td>
    <td width="42%">
      <img src="./docs/screenshots/tablet-explore.png" alt="KOMA Android Tablet Explore" />
      <p align="center"><sub><strong>Tablet Adaptive Layout</strong> — Docked Source Rail &amp; Multi-Column Catalog</sub></p>
    </td>
  </tr>
  <tr>
    <td width="58%">
      <img src="./docs/screenshots/desktop-reader.png" alt="KOMA OLED Pro Reader" />
      <p align="center"><sub><strong>OLED Pro Reader</strong> — Webtoon / RTL / Spread Modes, Zoom, Chapters Drawer &amp; Cruise</sub></p>
    </td>
    <td width="42%" align="center">
      <img src="./docs/screenshots/phone-home.png" alt="KOMA Android Phone" width="220" />
      <p align="center"><sub><strong>Android Phone</strong> — Bottom Thumb Dock &amp; Touch Gesture Reader</sub></p>
    </td>
  </tr>
</table>

<details>
  <summary><strong>View Manga Details &amp; Paginated Chapters Screenshot</strong></summary>
  <br />
  <img src="./docs/screenshots/desktop-details.png" alt="KOMA Series Details Page" />
</details>

---

## Key Features

- **Plug &amp; Play Bundle:** No Node.js, Java, or extension setup needed—desktop ships as a single standalone `KOMA-Portable.exe` and Android ships as a self-contained `KOMA-Android.apk` with the parser engine embedded directly inside.
- **100+ Verified Working Sources (EN / FR / AR / Multi):** Native **MangaBall**, **MangaDex**, **AsuraScans**, **WeebCentral**, **MangaRead**, **LELManga**, **TeamXNovel**, and an integrated **Cloudflare solver** (hidden Chromium / Android WebView).
- **Cinematic Launch Intro &amp; Interactive Walkthrough:** 0ms cached manga cover tile wall with `Made by VirtualDrum`, followed by an interactive 6-step onboarding tour on first launch.
- **Pro Adaptive OLED Reader:** Auto-detects Webtoon vs RTL Manga per series, per-manga mode/fit memory, OLED Ink preset, touch pinch-zoom / Ctrl+wheel zoom, In-Reader Chapter List (`C`), Auto-Scroll Cruise, and Binge Next chapter.
- **Library, Offline CBZ &amp; AniList Sync:** Custom shelves, sorting (`Last Read`, `Most Unread`, `A–Z`, `Added`), hover quick-resume Play, CBZ downloading grouped by series, drag-and-drop archive import, AniList metadata/recommendations (`stripTitleNoise` + `altTitles`), and cross-source migration.
- **In-App GitHub Auto-Updater:** Checks `vX.Y.Z`, updates both `.exe` and `.apk` inside Settings, restarts automatically, and displays a one-time **"What's New in ver : X.X.X"** changelog.

---

## Direct Downloads

| Platform | Package | Link |
| --- | --- | --- |
| **Easy Download Page (No GitHub UI)** | Windows &amp; Android + QR Code | [**nourddinachi20-rgb.github.io/KOMA**](https://nourddinachi20-rgb.github.io/KOMA/) |
| **Windows 10 / 11 (x64)** | `KOMA-Portable.exe` (`126.6 MB`) | [**Download Portable EXE**](https://github.com/nourddinachi20-rgb/KOMA/releases/latest/download/KOMA-Portable.exe) |
| **Android 8+ (Phone &amp; Tablet)** | `KOMA-Android.apk` (`11.0 MB`) | [**Download Android APK**](https://github.com/nourddinachi20-rgb/KOMA/releases/latest/download/KOMA-Android.apk) |

---

## Architecture &amp; Building From Source

- **Desktop:** Electron 35 + React 19 + Tailwind CSS v4 + Zustand + bundled slim JRE + Ktor CIO Kotlin engine (`kotatsu-parsers` + custom sources)
- **Android:** Capacitor 8 + native `KomaNativePlugin` + embedded Android `AndroidKomaEngine` (`Bitmap` / OkHttp / Ktor CIO / Android `WebView` Cloudflare solver)

```bash
# Install JS dependencies
npm install

# Run Desktop in dev mode
npm run dev

# Build standalone Windows Portable EXE
npm run pack:portable

# Build Android Phone & Tablet APK
npm run build:ui
npx cap sync android
cd android && ./gradlew assembleDebug

# Rebuild static download website into docs/
node scripts/build-website.mjs
```

---

<div align="center">
  <sub>Made by <strong>VirtualDrum</strong></sub>
</div>
