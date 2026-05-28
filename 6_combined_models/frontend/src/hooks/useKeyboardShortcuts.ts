import { useEffect } from 'react';
import type { Label } from '../types/measurement';

interface ShortcutHandlers {
  onLabel: (label: Label) => void;
  /** Keyboard key -> label, e.g. { '1': 'normal', '2': 'warning' }. */
  keyMap: Record<string, Label>;
  onSkip?: () => void;
  onAccept?: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export function useKeyboardShortcuts({ onLabel, keyMap, onSkip, onAccept, onNext, onPrev }: ShortcutHandlers) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // don't fire when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (keyMap[e.key]) {
        onLabel(keyMap[e.key]);
        return;
      }

      switch (e.key) {
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
  }, [onLabel, keyMap, onSkip, onAccept, onNext, onPrev]);
}
