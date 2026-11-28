import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { TitleBar, MobileBottomNav } from './components/TitleBar';
import { HomeView } from './components/HomeView';
import { LibraryView } from './components/LibraryView';
import { ExploreView } from './components/ExploreView';
import { CommandPalette } from './components/CommandPalette';
import { SplashScreen } from './components/SplashScreen';
import { ToastContainer } from './components/ToastContainer';
import { TutorialOverlay } from './components/TutorialOverlay';
import { WelcomeAuthModal } from './components/WelcomeAuthModal';
import { WhatsNewModal } from './components/WhatsNewModal';

const SourcesView = lazy(() =>
  import('./components/SourcesView').then((m) => ({ default: m.SourcesView })),
);
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView })),
);
const MangaDetailsPage = lazy(() =>
  import('./components/MangaDetailsPage').then((m) => ({ default: m.MangaDetailsPage })),
);
const ReaderView = lazy(() =>
  import('./components/ReaderView').then((m) => ({ default: m.ReaderView })),
);

export function App() {
  const {
    bootStage,
    settings,
    syncSession,
    activeView,
    goBackView,
    selectedManga,
    closeManga,
    readerSession,
    closeReader,
    commandOpen,
    setCommandOpen,
    notify,
    bootstrap,
    importDroppedPaths,
  } = useAppStore();
  const [draggingFiles, setDraggingFiles] = useState(false);
  const lastBackExitAtRef = useRef(0);
  const welcomePending = bootStage !== 'hydrating' && !syncSession && !settings.hasSeenWelcome;

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Hardware Back button (Android edge/nav back) & mouse Back side-button (button 3)
  useEffect(() => {
    const goBack = () => {
      const interceptEv = new CustomEvent('koma:back-intercept', { cancelable: true });
      window.dispatchEvent(interceptEv);
      if (interceptEv.defaultPrevented) {
        return;
      }
      if (commandOpen) {
        setCommandOpen(false);
      } else if (readerSession) {
        closeReader();
      } else if (selectedManga) {
        closeManga();
      } else if (goBackView()) {
        return;
      } else {
        const now = Date.now();
        if (now - lastBackExitAtRef.current < 2000) {
          void window.noctis.close();
        } else {
          lastBackExitAtRef.current = now;
          notify('Press back again to exit KOMA', 'info');
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        goBack();
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    const unsubIpc = window.noctis.onNavigateBack(goBack);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      unsubIpc();
    };
  }, [
    commandOpen,
    setCommandOpen,
    readerSession,
    selectedManga,
    closeReader,
    closeManga,
    goBackView,
    notify,
  ]);

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      setDraggingFiles(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setDraggingFiles(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingFiles(false);
    const files = Array.from(e.dataTransfer.files) as Array<File & { path?: string }>;
    const paths = files.map((f) => f.path).filter((p): p is string => Boolean(p));
    if (paths.length > 0) {
      void importDroppedPaths(paths);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-black text-white"
    >
      {!selectedManga && !welcomePending && <TitleBar />}

      <main className="relative flex-1 overflow-hidden">
        {!welcomePending && (
          <>
            {/* Keep core views mounted for 0ms instant tab switching & scroll preservation */}
            <div className={activeView === 'home' && !selectedManga ? 'h-full w-full' : 'hidden'}>
              <HomeView />
            </div>
            <div className={activeView === 'library' && !selectedManga ? 'h-full w-full' : 'hidden'}>
              <LibraryView />
            </div>
            <div className={activeView === 'explore' && !selectedManga ? 'h-full w-full' : 'hidden'}>
              <ExploreView />
            </div>

            <Suspense fallback={null}>
              {!selectedManga && activeView === 'sources' && <SourcesView />}
              {!selectedManga && activeView === 'settings' && <SettingsView />}
              {selectedManga && (
                <MangaDetailsPage key={`manga-${selectedManga.source}-${selectedManga.id}`} />
              )}
            </Suspense>
          </>
        )}
      </main>

      {!welcomePending && <MobileBottomNav />}

      {/* Drag-and-Drop CBZ/Folder Overlay */}
      {draggingFiles && (
        <div
          onDragLeave={() => setDraggingFiles(false)}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/90"
        >
          <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/30 bg-white/[0.04] px-14 py-12 text-center">
            <FolderPlus className="mb-3 h-10 w-10 accent-fg" />
            <p className="text-lg font-bold text-white">Drop to Import into KOMA</p>
            <p className="mt-1 text-xs text-zinc-400">
              Supports .cbz, .zip archives, or manga folders
            </p>
          </div>
        </div>
      )}

      <CommandPalette />
      <Suspense fallback={null}>
        {readerSession && <ReaderView />}
      </Suspense>
      <ToastContainer />
      <TutorialOverlay />
      <WhatsNewModal />
      <WelcomeAuthModal />
      <SplashScreen />
    </div>
  );
}

export default App;
