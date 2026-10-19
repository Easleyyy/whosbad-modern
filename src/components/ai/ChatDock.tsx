import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { create } from 'zustand';
import { DictationBar } from '@/components/ai/DictationBar';
import { DictationSheet } from '@/components/ai/DictationSheet';
import { DictationPanel } from '@/components/ai/DictationPanel';
import { useMediaQuery } from '@/hooks/useLayout';
import { useGlobalToasts } from '@/stores/toastStore';

// One assistant for the whole app, placed according to the room there is:
//  • ≥ 1024 px  → docked column on the right (collapsible); the page beside it re-flows to the width left
//  • < 1024 px  → bar above the tab bar that opens a sheet (kept above the on-screen keyboard)
//  • home page  → the page IS the chat, so neither is shown.

const KEY = 'wb-chat-open';
const read = (): boolean | null => {
  try { const v = localStorage.getItem(KEY); return v === null ? null : v === '1'; } catch { return null; }
};

interface DockState { open: boolean | null; setOpen: (v: boolean) => void }
const useDockState = create<DockState>((set) => ({
  open: read(),
  setOpen: (v) => {
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* private mode: the choice just isn't remembered */ }
    set({ open: v });
  },
}));

const HINTS: Record<string, string> = {
  '/tshirts': '« reçu 20 maillots Victor Bleu femme M »',
  '/adherents': '« ajoute l’adhérent Lucas MARTIN »',
};

function useChatToasts() {
  const { add } = useGlobalToasts();
  return {
    onSuccess: (m: string) => add(m, 'success'),
    onError: (m: string) => add(m, 'error'),
    onSlow: () => add('Réveil du serveur… patiente quelques secondes', 'info'),
  };
}

/** Right-hand column (desktop / wide tablet). */
export function ChatSide() {
  const { pathname } = useLocation();
  const docked = useMediaQuery('(min-width: 1024px)');
  const roomy = useMediaQuery('(min-width: 1280px)');
  const { open: pref, setOpen } = useDockState();
  const toasts = useChatToasts();

  if (!docked || pathname === '/') return null;
  const open = pref ?? roomy; // first visit: open when there's plenty of room, closed on a narrow laptop

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Ouvrir l'assistant"
        className="flex w-11 flex-none flex-col items-center gap-3 border-l-[1.5px] border-ink-rule bg-paper pt-4 hover:bg-ink/[.04]"
      >
        <span className="font-mono text-[10px] font-semibold tracking-kpi text-alert">IA</span>
        <span className="font-mono text-[10px] tracking-label text-ink-55 [writing-mode:vertical-rl]">ASSISTANT ‹</span>
      </button>
    );
  }
  return (
    <div className="h-full w-[clamp(300px,25vw,380px)] flex-none bg-paper">
      <DictationPanel {...toasts} onCollapse={() => setOpen(false)} />
    </div>
  );
}

/** Bar + sheet (phone / narrow tablet). */
export function ChatBar() {
  const { pathname } = useLocation();
  const docked = useMediaQuery('(min-width: 1024px)');
  const [sheetOpen, setSheetOpen] = useState(false);
  const toasts = useChatToasts();

  if (docked || pathname === '/') return null;
  return (
    <>
      <DictationBar onClick={() => setSheetOpen(true)} hint={HINTS[pathname]} />
      <DictationSheet isOpen={sheetOpen} onClose={() => setSheetOpen(false)} {...toasts} />
    </>
  );
}
