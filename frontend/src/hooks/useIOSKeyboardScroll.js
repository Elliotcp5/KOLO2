// Hook : gère proprement le clavier iOS/Android sur inputs/textareas.
// — Scrolle automatiquement l'élément focusé au-dessus du clavier
// — Empêche le password / email caché sous le clavier sur Login / Register / etc.
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

export function useIOSKeyboardScroll() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let keyboardHeight = 0;

    const scrollFocusedIntoView = () => {
      const el = document.activeElement;
      if (!el) return;
      const tag = (el.tagName || '').toUpperCase();
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;

      // Attend un tick pour laisser le clavier s'installer
      setTimeout(() => {
        try {
          const rect = el.getBoundingClientRect();
          const visibleBottom = window.innerHeight - keyboardHeight;
          // Si l'input est caché derrière le clavier, scroll it visible
          if (rect.bottom > visibleBottom - 20 || rect.top < 60) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } catch (_) {
          // ignore
        }
      }, 120);
    };

    let showHandle, hideHandle;
    (async () => {
      showHandle = await Keyboard.addListener('keyboardWillShow', (info) => {
        keyboardHeight = info?.keyboardHeight || 0;
        scrollFocusedIntoView();
      });
      hideHandle = await Keyboard.addListener('keyboardWillHide', () => {
        keyboardHeight = 0;
      });
    })();

    // Fallback : écoute aussi les focus d'inputs (utile si le plugin Keyboard
    // ne dispatch pas assez vite sur certains devices)
    const onFocusIn = () => scrollFocusedIntoView();
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      try { showHandle && showHandle.remove(); } catch (_) {}
      try { hideHandle && hideHandle.remove(); } catch (_) {}
    };
  }, []);
}
