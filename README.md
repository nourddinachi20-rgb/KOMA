<div align="center">
  <img src="./assets/icon.png" alt="KOMA Logo" width="84" height="84" />
  <h1>K O M A</h1>
  <p><strong>Manga &amp; Manhwa Reader for Windows, Android Phones &amp; Tablets</strong></p>
  <p><sub>By VirtualDrum</sub></p>

  <p>
    <a href="https://nourddinachi20-rgb.github.io/KOMA/">
      <img src="https://img.shields.io/badge/Website-Download_KOMA-FFFFFF?style=for-the-badge&logoColor=000000" alt="Download Website" />
    </a>
    <a href="https://github.com/nourddinachi20-rgb/KOMA/releases/latest">
      <img src="https://img.shields.io/badge/Release-v1.0.7-111111?style=for-the-badge&labelColor=000000" alt="Release v1.0.7" />
    </a>
    <img src="https://img.shields.io/badge/Windows-Portable_EXE-000000?style=for-the-badge&logo=windows&logoColor=FFFFFF" alt="Windows" />
    <img src="https://img.shields.io/badge/Android-Phone_%26_Tablet_APK-000000?style=for-the-badge&logo=android&logoColor=FFFFFF" alt="Android" />
  </p>

  <h3>
    <a href="https://nourddinachi20-rgb.github.io/KOMA/">Open Download Page →</a>
  </h3>
</div>

---

## Screenshots (PC · Tablet · Phone)

<table>
  <tr>
    <td width="58%">
      <img src="./docs/screenshots/desktop-home.png" alt="KOMA Windows Desktop" />
      <p align="center"><sub><strong>Windows Desktop</strong></sub></p>
    </td>
    <td width="42%">
      <img src="./docs/screenshots/tablet-explore.png" alt="KOMA Android Tablet" />
      <p align="center"><sub><strong>Android Tablet</strong></sub></p>
    </td>
  </tr>
  <tr>
    <td width="58%">
      <img src="./docs/screenshots/desktop-reader.png" alt="KOMA Reader" />
      <p align="center"><sub><strong>Reader</strong> — Webtoon / RTL / Spread, Zoom &amp; Chapters Drawer</sub></p>
    </td>
    <td width="42%" align="center">
      <img src="./docs/screenshots/phone-home.png" alt="KOMA Android Phone" width="220" />
      <p align="center"><sub><strong>Android Phone</strong></sub></p>
    </td>
  </tr>
</table>

<details>
  <summary><strong>Series Details Screenshot</strong></summary>
  <br />
  <img src="./docs/screenshots/desktop-details.png" alt="KOMA Series Details" />
</details>

---

## Features

- **Zero Setup:** Standalone `KOMA-Portable.exe` on Windows and self-contained `KOMA-Android.apk` on Android phones &amp; tablets.
- **Customizable Appearance &amp; Languages:** Pure black-and-white OLED default with Dark Slate &amp; Light Paper themes, custom accent color picker, and English / French / Arabic UI (more languages coming soon).
- **EN / FR / AR Sources:** Built-in MangaBall, MangaDex, AsuraScans, WeebCentral, MangaRead, LELManga, TeamXNovel, and Cloudflare solver.
- **Adaptive Reader:** Auto-detects Webtoon vs RTL Manga per series, zoom, auto-scroll, chapter list drawer (`C`), and OLED black ink preset.
- **Offline CBZ &amp; Tracking:** Save chapters as `.cbz`, import local archives, sync with AniList, and update Windows/Android directly in Settings.

---

## Downloads

| Platform | File | Link |
| --- | --- | --- |
| **Download Page** | Windows + Android + QR | [**nourddinachi20-rgb.github.io/KOMA**](https://nourddinachi20-rgb.github.io/KOMA/) |
| **Windows (x64)** | `KOMA-Portable.exe` | [**Download Portable EXE**](https://github.com/nourddinachi20-rgb/KOMA/releases/latest/download/KOMA-Portable.exe) |
| **Android (8+)** | `KOMA-Android.apk` | [**Download Android APK**](https://github.com/nourddinachi20-rgb/KOMA/releases/latest/download/KOMA-Android.apk) |

---

## Build From Source

```bash
npm install
npm run dev              # Windows desktop dev
npm run pack:portable    # Windows KOMA-Portable.exe
npm run build:ui         # Build UI bundle
npx cap sync android     # Sync Android web assets
node scripts/build-website.mjs  # Rebuild docs/ download page
```

<div align="center">
  <sub>Made by <strong>VirtualDrum</strong></sub>
</div>
