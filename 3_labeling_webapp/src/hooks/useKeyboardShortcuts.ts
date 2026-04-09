import { useEffect } from 'react';
import type { Label } from '../types/measurement';

interface ShortcutHandlers {
  onLabel: (label: Label) => void;
  onSkip?: () => void;
  onAccept?: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function useKeyboardShortcuts({ onLabel, onSkip, onAccept, onNext, onPrev }: ShortcutHandlers) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // don't fire when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case '1':
          onLabel('normal');
          break;
        case '2':
          onLabel('warning');
          break;
        case '3':
          onLabel('critical');
          break;
        case 's':
        case 'S':
          onSkip?.();
          break;
        case 'Enter':
          onAccept?.();
          break;
        case 'ArrowLeft':
          onPrev();
          break;
        case 'ArrowRight':
          onNext();
          break;
      }
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onLabel, onSkip, onAccept, onNext, onPrev]);
}
