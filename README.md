# KOMA — OLED Manga Sanctuary (Windows & Android)

> **Crafted by VirtualDrum** · Plug-and-play futuristic `#000000` OLED manga & manhwa sanctuary for Windows Desktop, Android Phones, and Android Tablets.

## Highlights
- **Multi-Platform:** Windows Desktop (`KOMA.exe` / single-file `KOMA-Portable.exe`) and Android Phone + Tablet (`KOMA-Android.apk`).
- **Bundled Verified Sources:** Native **MangaBall**, **MangaDex**, **AsuraScans**, **WeebCentral**, **MangaRead**, **LELManga**, **TeamXNovel**, and more (EN / FR / AR / Multi).
- **Cinematic Launch Intro:** GPU-accelerated drifting manga cover tile wall featuring **`Made by VirtualDrum`**, interactive 6-step onboarding tutorial on first run, and one-time **`What's New`** modal after every app update.
- **Pro OLED Reader:** Auto-detects Webtoon vs RTL Manga per series, remembers layout per manga, OLED True-Black Ink contrast, pinch/Ctrl-wheel zoom, In-Reader Chapter List (`C`), Auto-Scroll Cruise, and Binge Next chapter.
- **Offline Sanctuary & Sync:** CBZ chapter downloading, local CBZ/folder import, AniList metadata/recommendations & progress sync, cross-source migration, and in-app GitHub auto-updating for both `.exe` and `.apk`.

## Development & Building
```bash
# Desktop dev
npm install
npm run dev

# Build Desktop Portable EXE
npm run pack:portable

# Build Android APK
npm run build:ui
npx cap sync android
cd android && ./gradlew assembleDebug
```
