import { useAppStore } from '../store/useAppStore';
import type { UiLanguage } from '../types';

export interface Translations {
  nav: {
    home: string;
    library: string;
    updates: string;
    explore: string;
    offline: string;
    sources: string;
    settings: string;
    back: string;
    search: string;
    more: string;
    sourcesCount: string;
    booting: string;
    engineOffline: string;
  };
  home: {
    spotlight: string;
    readNow: string;
    details: string;
    inLibrary: string;
    addToLibrary: string;
    continueReading: string;
    explore: string;
    loadingTitle: string;
    loadingSources: string;
    connectingEngine: string;
    browseSources: string;
    importCbz: string;
    sourceNoResponse: string;
    by: string;
  };
  library: {
    title: string;
    seriesCount: string;
    sortLastRead: string;
    sortUnread: string;
    sortTitle: string;
    sortAdded: string;
    unreadOnly: string;
    checkUpdates: string;
    checking: string;
    importCbz: string;
    importFolder: string;
    seriesRead: string;
    chaptersFinished: string;
    pagesRead: string;
    streak: string;
    topGenre: string;
    all: string;
  };
  updates: {
    title: string;
    chaptersDiscovered: string;
    clearFeed: string;
    checkUpdates: string;
    checking: string;
    today: string;
    yesterday: string;
    thisWeek: string;
    earlier: string;
  };
  downloads: {
    title: string;
    savedOffline: string;
    emptyTitle: string;
    emptySub: string;
  };
  explore: {
    sources: string;
    searchPlaceholder: string;
  };
  sources: {
    title: string;
    searchPlaceholder: string;
    cfMode: string;
    showingAll: string;
    reverify: string;
    scanning: string;
  };
  settings: {
    title: string;
    subtitle: string;
    appearanceTitle: string;
    themeLabel: string;
    themeDesc: string;
    themeOled: string;
    themeDark: string;
    themePaper: string;
    accentLabel: string;
    accentDesc: string;
    customColor: string;
    resetBw: string;
    languageTitle: string;
    languageLabel: string;
    languageDesc: string;
    moreLanguagesNote: string;
    anilistTitle: string;
    readerVisualsTitle: string;
    ambientGlow: string;
    ambientGlowDesc: string;
    oledInk: string;
    oledInkDesc: string;
    autoCheckUpdates: string;
    autoCheckUpdatesDesc: string;
    discordRpc: string;
    discordRpcDesc: string;
    preloadPages: string;
    preloadPagesDesc: string;
    sourcesContentTitle: string;
    showNsfw: string;
    showNsfwDesc: string;
    sourceLangs: string;
    sourceLangsDesc: string;
    backupEngineTitle: string;
    exportBackup: string;
    restoreBackup: string;
    restartEngine: string;
    clearCache: string;
    updatesVersionTitle: string;
    installed: string;
    githubRepo: string;
    githubRepoDesc: string;
    checkForUpdates: string;
    checkingUpdates: string;
    updateAndRestart: string;
    whatsNew: string;
    interactiveTutorial: string;
    accountTitle: string;
    accountSummary: string;
    backupSectionTitle: string;
    trackersSectionTitle: string;
    trackersOptional: string;
  };
  reader: {
    chapters: string;
    cruise: string;
    display: string;
    brightness: string;
    contrast: string;
    warmth: string;
    cruiseSpeed: string;
    oledInk: string;
    bingeNext: string;
    jumpChapter: string;
    now: string;
  };
  splash: {
    hydrating: string;
    engine: string;
    warming: string;
    ready: string;
    madeBy: string;
  };
  whatsNew: {
    badge: string;
    titlePrefix: string;
    gotIt: string;
  };
  tutorial: {
    skip: string;
    back: string;
    next: string;
    enter: string;
  };
}

const EN: Translations = {
  nav: {
    home: 'Home',
    library: 'Library',
    updates: 'Updates',
    explore: 'Explore',
    offline: 'Offline',
    sources: 'Sources',
    settings: 'Settings',
    back: 'Back',
    search: 'Search',
    more: 'More',
    sourcesCount: 'SOURCES',
    booting: 'BOOTING',
    engineOffline: 'ENGINE OFFLINE',
  },
  home: {
    spotlight: 'Spotlight',
    readNow: 'Read Now',
    details: 'Details & Chapters',
    inLibrary: 'In Library',
    addToLibrary: 'Add to Library',
    continueReading: 'Continue Reading',
    explore: 'Explore',
    loadingTitle: 'Loading KOMA',
    loadingSources: 'Loading feeds from your verified sources...',
    connectingEngine: 'Starting bundled manga engine...',
    browseSources: 'Browse Sources',
    importCbz: 'Import CBZ',
    sourceNoResponse: 'did not respond — try switching sources in Explore or Sources.',
    by: 'by',
  },
  library: {
    title: 'Library',
    seriesCount: 'series',
    sortLastRead: 'Sort: Last Read',
    sortUnread: 'Sort: Most Unread',
    sortTitle: 'Sort: Title A–Z',
    sortAdded: 'Sort: Recently Added',
    unreadOnly: 'Unread Only',
    checkUpdates: 'Check Updates',
    checking: 'Checking...',
    importCbz: 'Import CBZ',
    importFolder: 'Import Folder',
    seriesRead: 'Manga Read',
    chaptersFinished: 'Chapters Finished',
    pagesRead: 'Pages Read',
    streak: 'Reading Streak',
    topGenre: 'Top Genre',
    all: 'All',
  },
  updates: {
    title: 'Updates',
    chaptersDiscovered: 'new chapters',
    clearFeed: 'Clear Feed',
    checkUpdates: 'Check Updates',
    checking: 'Checking...',
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    earlier: 'Earlier',
  },
  downloads: {
    title: 'Offline Downloads',
    savedOffline: 'chapters saved offline',
    emptyTitle: 'No offline chapters yet',
    emptySub: 'Open any manga page and download chapters into CBZ.',
  },
  explore: {
    sources: 'Sources',
    searchPlaceholder: 'Search this source...',
  },
  sources: {
    title: 'Sources',
    searchPlaceholder: 'Search sources...',
    cfMode: 'CF Unlock Mode',
    showingAll: 'Showing All',
    reverify: 'Re-Verify Live',
    scanning: 'Scanning...',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Customize theme, accent color, language, trackers, and updates.',
    appearanceTitle: 'Appearance & Theme',
    themeLabel: 'Background Theme',
    themeDesc: 'Choose Pure OLED Black, Charcoal Dark, or Light Paper',
    themeOled: 'Pure Black',
    themeDark: 'Dark Slate',
    themePaper: 'Light Paper',
    accentLabel: 'Accent Color',
    accentDesc: 'Pure White is default; pick any highlight color or custom swatch',
    customColor: 'Custom',
    resetBw: 'Reset B&W',
    languageTitle: 'Language / Langue / اللغة',
    languageLabel: 'Interface Language',
    languageDesc: 'Switch menus across English, French, and Arabic',
    moreLanguagesNote: 'More languages coming soon.',
    anilistTitle: 'AniList Two-Way Tracker Sync',
    readerVisualsTitle: 'Reader & Integrations',
    ambientGlow: 'Cover Ambient Glow',
    ambientGlowDesc: 'Subtle background lighting matched to the active series cover',
    oledInk: 'OLED True-Black Ink',
    oledInkDesc: 'Boosts black contrast so dark panels blend cleanly into #000000',
    autoCheckUpdates: 'Auto-Check Library Updates',
    autoCheckUpdatesDesc: 'Check saved series for new chapters on launch',
    discordRpc: 'Discord Rich Presence',
    discordRpcDesc: 'Display reading status on your Discord profile',
    preloadPages: 'Preload Pages Ahead',
    preloadPagesDesc: 'Upcoming pages decoded ahead while reading',
    sourcesContentTitle: 'Sources & Content',
    showNsfw: 'Show 18+ / NSFW Sources',
    showNsfwDesc: 'Include adult-marked extensions in Explore and Sources',
    sourceLangs: 'Preferred Source Languages',
    sourceLangsDesc: 'Comma-separated ISO codes (en, fr, ar)',
    backupEngineTitle: 'Backup & Engine Diagnostics',
    exportBackup: 'Export Backup (.json)',
    restoreBackup: 'Restore Backup',
    restartEngine: 'Restart Engine',
    clearCache: 'Clear Image Cache',
    updatesVersionTitle: 'App Updates & Version',
    installed: 'Installed',
    githubRepo: 'GitHub Releases Repository',
    githubRepoDesc: 'Checks GitHub Releases for new Windows (.exe) & Android (.apk) builds',
    checkForUpdates: 'Check for Updates',
    checkingUpdates: 'Checking...',
    updateAndRestart: 'Update & Restart',
    whatsNew: "What's New",
    interactiveTutorial: 'Interactive Tutorial',
    accountTitle: 'Account & Sync',
    accountSummary: 'Username + Password · Zero-Knowledge Encrypted',
    backupSectionTitle: 'Backup & Storage',
    trackersSectionTitle: 'AniList & Discord',
    trackersOptional: 'Optional progress sync',
  },
  reader: {
    chapters: 'Chapters',
    cruise: 'Cruise',
    display: 'Display',
    brightness: 'Brightness',
    contrast: 'Contrast',
    warmth: 'Warm Tint',
    cruiseSpeed: 'Cruise Speed',
    oledInk: 'OLED Ink',
    bingeNext: 'Binge Next',
    jumpChapter: 'Jump to chapter...',
    now: 'NOW',
  },
  splash: {
    hydrating: 'Loading Library',
    engine: 'Starting Engine',
    warming: 'Syncing Catalogs',
    ready: 'Ready',
    madeBy: 'Made by VirtualDrum',
  },
  whatsNew: {
    badge: 'Release Notes',
    titlePrefix: "What's New in ver :",
    gotIt: 'Continue',
  },
  tutorial: {
    skip: 'Skip Tour',
    back: 'Back',
    next: 'Next',
    enter: 'Start Reading',
  },
};

const FR: Translations = {
  nav: {
    home: 'Accueil',
    library: 'Bibliothèque',
    updates: 'Nouveautés',
    explore: 'Explorer',
    offline: 'Hors-ligne',
    sources: 'Sources',
    settings: 'Paramètres',
    back: 'Retour',
    search: 'Rechercher',
    more: 'Plus',
    sourcesCount: 'SOURCES',
    booting: 'DÉMARRAGE',
    engineOffline: 'MOTEUR HORS-LIGNE',
  },
  home: {
    spotlight: 'À la une',
    readNow: 'Lire',
    details: 'Détails & Chapitres',
    inLibrary: 'Dans ma liste',
    addToLibrary: 'Ajouter',
    continueReading: 'Reprendre la lecture',
    explore: 'Tout voir',
    loadingTitle: 'Chargement de KOMA',
    loadingSources: 'Chargement des catalogues vérifiés...',
    connectingEngine: 'Démarrage du moteur intégré...',
    browseSources: 'Parcourir les sources',
    importCbz: 'Importer CBZ',
    sourceNoResponse: "ne répond pas pour l'instant — essayez une autre source.",
    by: 'par',
  },
  library: {
    title: 'Bibliothèque',
    seriesCount: 'séries',
    sortLastRead: 'Tri : Récents',
    sortUnread: 'Tri : Non lus',
    sortTitle: 'Tri : A–Z',
    sortAdded: 'Tri : Ajoutés',
    unreadOnly: 'Non lus',
    checkUpdates: 'Actualiser',
    checking: 'Vérification...',
    importCbz: 'Importer CBZ',
    importFolder: 'Importer Dossier',
    seriesRead: 'Séries lues',
    chaptersFinished: 'Chapitres lus',
    pagesRead: 'Pages lues',
    streak: 'Série de jours',
    topGenre: 'Genre favori',
    all: 'Tous',
  },
  updates: {
    title: 'Nouveautés',
    chaptersDiscovered: 'nouveaux chapitres',
    clearFeed: 'Effacer',
    checkUpdates: 'Vérifier',
    checking: 'Vérification...',
    today: "Aujourd'hui",
    yesterday: 'Hier',
    thisWeek: 'Cette semaine',
    earlier: 'Plus tôt',
  },
  downloads: {
    title: 'Hors-ligne',
    savedOffline: 'chapitres enregistrés',
    emptyTitle: 'Aucun téléchargement',
    emptySub: 'Téléchargez des chapitres en CBZ depuis la page d’une série.',
  },
  explore: {
    sources: 'Sources',
    searchPlaceholder: 'Rechercher dans cette source...',
  },
  sources: {
    title: 'Sources',
    searchPlaceholder: 'Rechercher une source...',
    cfMode: 'Mode Cloudflare',
    showingAll: 'Toutes affichées',
    reverify: 'Revérifier',
    scanning: 'Analyse...',
  },
  settings: {
    title: 'Paramètres',
    subtitle: 'Personnalisez le thème, les couleurs, la langue, les trackers et les mises à jour.',
    appearanceTitle: 'Apparence & Thème',
    themeLabel: 'Thème visuel',
    themeDesc: 'Choisissez Noir Pur OLED, Sombre Ardoise ou Papier Clair',
    themeOled: 'Noir Pur',
    themeDark: 'Sombre',
    themePaper: 'Clair',
    accentLabel: "Couleur d'accentuation",
    accentDesc: 'Blanc Pur par défaut ; choisissez une couleur ou palette personnalisée',
    customColor: 'Perso',
    resetBw: 'Réinit. N&B',
    languageTitle: 'Langue / Language / اللغة',
    languageLabel: "Langue de l'interface",
    languageDesc: 'Choisissez Français, Anglais ou Arabe',
    moreLanguagesNote: "Plus de langues à venir prochainement.",
    anilistTitle: 'Synchronisation AniList',
    readerVisualsTitle: 'Lecteur & Intégrations',
    ambientGlow: 'Halo ambiant des couvertures',
    ambientGlowDesc: 'Éclairage subtil assorti à la couverture sélectionnée',
    oledInk: 'Noir profond OLED',
    oledInkDesc: 'Renforce les noirs pour fondre les planches sur #000000',
    autoCheckUpdates: 'Vérifier les chapitres au lancement',
    autoCheckUpdatesDesc: 'Recherche silencieuse de nouveaux chapitres au démarrage',
    discordRpc: 'Discord Rich Presence',
    discordRpcDesc: 'Afficher le titre et le chapitre en cours sur Discord',
    preloadPages: 'Préchargement des pages',
    preloadPagesDesc: "Pages suivantes décodées à l'avance pendant la lecture",
    sourcesContentTitle: 'Sources & Contenu',
    showNsfw: 'Afficher les sources 18+ / NSFW',
    showNsfwDesc: 'Inclure les catalogues adultes dans Explorer et Sources',
    sourceLangs: 'Langues des sources préférées',
    sourceLangsDesc: 'Codes ISO séparés par des virgules (en, fr, ar)',
    backupEngineTitle: 'Sauvegardes & Moteur',
    exportBackup: 'Exporter (.json)',
    restoreBackup: 'Restaurer',
    restartEngine: 'Redémarrer le moteur',
    clearCache: 'Vider le cache images',
    updatesVersionTitle: 'Mises à jour & Version',
    installed: 'Installée',
    githubRepo: 'Dépôt GitHub Releases',
    githubRepoDesc: 'Vérifie les mises à jour Windows (.exe) et Android (.apk)',
    checkForUpdates: 'Vérifier les mises à jour',
    checkingUpdates: 'Vérification...',
    updateAndRestart: 'Mettre à jour & Redémarrer',
    whatsNew: 'Nouveautés',
    interactiveTutorial: 'Tutoriel interactif',
    accountTitle: 'Compte & Synchronisation',
    accountSummary: 'Identifiant + Mot de passe · Chiffrement Zero-Knowledge',
    backupSectionTitle: 'Sauvegarde & Stockage',
    trackersSectionTitle: 'AniList & Discord',
    trackersOptional: 'Suivi de progression optionnel',
  },
  reader: {
    chapters: 'Chapitres',
    cruise: 'Défilement',
    display: 'Affichage',
    brightness: 'Luminosité',
    contrast: 'Contraste',
    warmth: 'Chaleur',
    cruiseSpeed: 'Vitesse',
    oledInk: 'Encre OLED',
    bingeNext: 'Enchaîner',
    jumpChapter: 'Aller au chapitre...',
    now: 'ACTUEL',
  },
  splash: {
    hydrating: 'Chargement',
    engine: 'Moteur en cours',
    warming: 'Synchronisation',
    ready: 'Prêt',
    madeBy: 'Créé par VirtualDrum',
  },
  whatsNew: {
    badge: 'Notes de version',
    titlePrefix: 'Nouveautés v :',
    gotIt: 'Continuer',
  },
  tutorial: {
    skip: 'Passer',
    back: 'Retour',
    next: 'Suivant',
    enter: 'Commencer',
  },
};

const AR: Translations = {
  nav: {
    home: 'الرئيسية',
    library: 'المكتبة',
    updates: 'التحديثات',
    explore: 'استكشاف',
    offline: 'بدون نت',
    sources: 'المصادر',
    settings: 'الإعدادات',
    back: 'رجوع',
    search: 'بحث',
    more: 'المزيد',
    sourcesCount: 'مصدر',
    booting: 'جارٍ التشغيل',
    engineOffline: 'المحرك متوقف',
  },
  home: {
    spotlight: 'مختارات',
    readNow: 'اقرأ الآن',
    details: 'التفاصيل والفصول',
    inLibrary: 'في المكتبة',
    addToLibrary: 'إضافة للمكتبة',
    continueReading: 'متابعة القراءة',
    explore: 'استكشاف',
    loadingTitle: 'جارٍ تحميل KOMA',
    loadingSources: 'جاري تحميل القوائم من المصادر الموثوقة...',
    connectingEngine: 'جاري تشغيل محرك المانجا المدمج...',
    browseSources: 'تصفح المصادر',
    importCbz: 'استيراد CBZ',
    sourceNoResponse: 'لم يستجب حالياً — جرّب مصدراً آخر من استكشاف.',
    by: 'بواسطة',
  },
  library: {
    title: 'المكتبة',
    seriesCount: 'عمل',
    sortLastRead: 'ترتيب: آخر قراءة',
    sortUnread: 'ترتيب: الأكثر فصولاً غير مقروءة',
    sortTitle: 'ترتيب: أبجدي',
    sortAdded: 'ترتيب: المضافة حديثاً',
    unreadOnly: 'غير المقروءة فقط',
    checkUpdates: 'فحص التحديثات',
    checking: 'جاري الفحص...',
    importCbz: 'استيراد CBZ',
    importFolder: 'استيراد مجلد',
    seriesRead: 'المانغا المقروءة',
    chaptersFinished: 'الفصول المكتملة',
    pagesRead: 'الصفحات المقروءة',
    streak: 'أيام متواصلة',
    topGenre: 'التصنيف المفضل',
    all: 'الكل',
  },
  updates: {
    title: 'التحديثات',
    chaptersDiscovered: 'فصل جديد',
    clearFeed: 'مسح القائمة',
    checkUpdates: 'فحص الآن',
    checking: 'جاري الفحص...',
    today: 'اليوم',
    yesterday: 'أمس',
    thisWeek: 'هذا الأسبوع',
    earlier: 'سابقاً',
  },
  downloads: {
    title: 'التحميلات',
    savedOffline: 'فصل محفوظ',
    emptyTitle: 'لا توجد فصول محفوظة بعد',
    emptySub: 'افتح أي مانجا وحمّل الفصول بصيغة CBZ للقراءة بدون إنترنت.',
  },
  explore: {
    sources: 'المصادر',
    searchPlaceholder: 'ابحث في هذا المصدر...',
  },
  sources: {
    title: 'المصادر',
    searchPlaceholder: 'ابحث عن مصدر...',
    cfMode: 'فك حماية Cloudflare',
    showingAll: 'عرض الكل',
    reverify: 'إعادة الفحص',
    scanning: 'جاري الفحص...',
  },
  settings: {
    title: 'الإعدادات',
    subtitle: 'خصّص المظهر، الألوان، اللغة، التتبع، وتحديثات التطبيق.',
    appearanceTitle: 'المظهر والتخصيص',
    themeLabel: 'سمة الخلفية',
    themeDesc: 'اختر أسود OLED نقي، داكن، أو فاتح',
    themeOled: 'أسود نقي',
    themeDark: 'داكن',
    themePaper: 'فاتح',
    accentLabel: 'لون التمييز',
    accentDesc: 'الأبيض النقي هو الافتراضي؛ اختر أي لون أو خصص لونك',
    customColor: 'مخصص',
    resetBw: 'أبيض وأسود',
    languageTitle: 'اللغة / Language / Langue',
    languageLabel: 'لغة الواجهة',
    languageDesc: 'بدّل الواجهة بين العربية والإنجليزية والفرنسية',
    moreLanguagesNote: 'سيتم إضافة المزيد من اللغات قريباً.',
    anilistTitle: 'مزامنة AniList',
    readerVisualsTitle: 'القارئ والتكامل',
    ambientGlow: 'توهج الغلاف المحيطي',
    ambientGlowDesc: 'إضاءة خفيفة تتناسب مع غلاف العمل',
    oledInk: 'حبر OLED الأسود',
    oledInkDesc: 'يعزز تباين اللون الأسود ليندمج مع #000000',
    autoCheckUpdates: 'فحص تحديثات المكتبة تلقائياً',
    autoCheckUpdatesDesc: 'البحث عن فصول جديدة عند تشغيل التطبيق',
    discordRpc: 'حالة Discord Rich Presence',
    discordRpcDesc: 'عرض المانجا والفصل الحالي في حسابك على Discord',
    preloadPages: 'التحميل المسبق للصفحات',
    preloadPagesDesc: 'تجهيز الصفحات التالية مسبقاً أثناء القراءة',
    sourcesContentTitle: 'المصادر والمحتوى',
    showNsfw: 'إظهار مصادر +18 / NSFW',
    showNsfwDesc: 'تضمين المصادر المخصصة للبالغين في الاستكشاف',
    sourceLangs: 'لغات المصادر المفضلة',
    sourceLangsDesc: 'رموز اللغات مفصولة بفاصلة (en, fr, ar)',
    backupEngineTitle: 'النسخ الاحتياطي والمحرك',
    exportBackup: 'تصدير نسخة (.json)',
    restoreBackup: 'استعادة نسخة',
    restartEngine: 'إعادة تشغيل المحرك',
    clearCache: 'مسح ذاكرة الصور',
    updatesVersionTitle: 'تحديثات التطبيق والإصدار',
    installed: 'المثبت',
    githubRepo: 'مستودع GitHub Releases',
    githubRepoDesc: 'يتحقق من تحديثات Windows (.exe) و Android (.apk)',
    checkForUpdates: 'البحث عن تحديثات',
    checkingUpdates: 'جاري الفحص...',
    updateAndRestart: 'تحديث وإعادة التشغيل',
    whatsNew: 'ما الجديد',
    interactiveTutorial: 'الجولة التعريفية',
    accountTitle: 'الحساب والمزامنة',
    accountSummary: 'اسم المستخدم وكلمة المرور · تشفير تام بدون خادم',
    backupSectionTitle: 'النسخ الاحتياطي والتخزين',
    trackersSectionTitle: 'AniList و Discord',
    trackersOptional: 'مزامنة اختيارية للتقدم',
  },
  reader: {
    chapters: 'الفصول',
    cruise: 'تمرير تلقائي',
    display: 'العرض',
    brightness: 'السطوع',
    contrast: 'التباين',
    warmth: 'الدفء',
    cruiseSpeed: 'السرعة',
    oledInk: 'حبر OLED',
    bingeNext: 'التالي تلقائياً',
    jumpChapter: 'انتقل إلى فصل...',
    now: 'الحالي',
  },
  splash: {
    hydrating: 'جاري التحميل',
    engine: 'تشغيل المحرك',
    warming: 'مزامنة الفهارس',
    ready: 'جاهز',
    madeBy: 'تطوير VirtualDrum',
  },
  whatsNew: {
    badge: 'ملاحظات الإصدار',
    titlePrefix: 'ما الجديد في الإصدار :',
    gotIt: 'متابعة',
  },
  tutorial: {
    skip: 'تخطي',
    back: 'السابق',
    next: 'التالي',
    enter: 'ابدأ القراءة',
  },
};

export const DICTIONARIES: Record<UiLanguage, Translations> = {
  en: EN,
  fr: FR,
  ar: AR,
};

export function getTranslations(lang: UiLanguage | undefined): Translations {
  if (lang === 'fr') return FR;
  if (lang === 'ar') return AR;
  return EN;
}

export function useT(): Translations {
  const lang = useAppStore((s) => s.settings.uiLanguage);
  return getTranslations(lang);
}
