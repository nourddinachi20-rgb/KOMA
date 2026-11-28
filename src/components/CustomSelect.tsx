import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

const CLOSE_POPOVERS_EVENT = 'koma:close-popovers';

export function closeAllPopovers(exceptId?: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CLOSE_POPOVERS_EVENT, { detail: { exceptId } }));
}

export function useClosePopoversListener(myId: string, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ exceptId?: string }>).detail;
      if (detail?.exceptId !== myId) {
        onCloseRef.current();
      }
    };
    window.addEventListener(CLOSE_POPOVERS_EVENT, handler);
    return () => window.removeEventListener(CLOSE_POPOVERS_EVENT, handler);
  }, [myId]);
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface CustomSelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  prefixIcon?: ReactNode;
  className?: string;
  menuAlign?: 'left' | 'right';
}

export function CustomSelect({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Select...',
  prefixIcon,
  className = '',
  menuAlign = 'right',
}: CustomSelectProps) {
  const myId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; openUp: boolean }>({
    top: 0,
    left: 0,
    width: 200,
    openUp: false,
  });

  useClosePopoversListener(myId, () => setOpen(false));

  const selected = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const minMenuW = Math.max(rect.width, 190);
    const maxMenuW = Math.min(320, window.innerWidth - 24);
    const width = Math.min(Math.max(rect.width, minMenuW), maxMenuW);
    const estHeight = Math.min(272, options.length * 40 + 16);
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const openUp = spaceBelow < estHeight && rect.top > estHeight;
    const top = openUp ? Math.max(12, rect.top - estHeight - 6) : Math.min(window.innerHeight - estHeight - 12, rect.bottom + 6);
    const rawLeft = menuAlign === 'right' ? rect.right - width : rect.left;
    const left = Math.max(12, Math.min(rawLeft, window.innerWidth - width - 12));
    setPos({ top, left, width, openUp });
  }, [open, options.length, menuAlign]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', () => setOpen(false));
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) {
      closeAllPopovers(myId);
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        aria-expanded={open}
        className={`inline-flex items-center justify-between gap-2.5 rounded-full border border-white/12 bg-white/[0.05] px-3.5 py-2 text-xs leading-none text-zinc-200 transition hover:border-white/25 hover:text-white disabled:opacity-40 cursor-pointer ${className}`}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          {prefixIcon && <span className="inline-flex shrink-0 items-center">{prefixIcon}</span>}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform duration-150 ${
            open ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[130]" onClick={() => setOpen(false)}>
            <div
              ref={menuRef}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                width: pos.width,
              }}
              className="max-h-68 overflow-y-auto rounded-2xl border border-white/15 bg-[#0C0C10] p-1.5 shadow-2xl"
            >
              {options.map((opt) => {
                const active = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs leading-snug transition cursor-pointer ${
                      active
                        ? 'accent-bg font-semibold'
                        : 'text-zinc-200 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{opt.label}</div>
                      {opt.description && (
                        <div className={`truncate text-[10px] ${active ? 'opacity-75' : 'text-zinc-500'}`}>
                          {opt.description}
                        </div>
                      )}
                    </div>
                    {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
