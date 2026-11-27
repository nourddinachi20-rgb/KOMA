# Changelog

## v1.0.0 — Initial Release (VirtualDrum)

### New Features
- **Android Phone & Tablet App:** Embedded native Kotlin Kotatsu/MangaBall Ktor engine, adaptive phone bottom dock & tablet rails, touch pinch-to-zoom, SAF CBZ import, and Chromium WebView Cloudflare solver.
- **In-App GitHub Auto-Updater:** Check version & update both Windows (`.exe`) and Android (`.apk`) straight from Settings with automatic restart & `"What's New"` screen.
- **Interactive Onboarding Tour:** 6-step guided interactive walkthrough on first launch highlighting Hero Spotlight, Sources, Reader, Library, Offline Sanctuary, and Auto-Updater.
- **In-Reader Chapter Drawer & Scrubber:** Search/jump chapters inside the reader (`C`) and hover-scrub page tooltips.

### Improvements & Performance
- **Zero-Blur OLED Compositing:** Pure CSS radial glows, native OS fonts, and 0ms persistent core tabs.
- **Drifting Manga Cover Intro:** Instant SSD-cached manga cover wall featuring `Made by VirtualDrum`.
- **Trending Home Curation:** Hero Spotlight and Home shelves locked to popularity sort orders across top sources.

### Bug Fixes
- **Launch Cover Reliability:** Prevented pre-boot unproxied external hotlink errors and added retry backoff + Kotlin host concurrency semaphores.
- **AniList Metadata Matching:** Normalized bracketed source tags (e.g. `(LICO)`) and `altTitles` fallbacks for Related Entries & Recommendations.
