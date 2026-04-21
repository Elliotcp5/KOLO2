// Hook : gère proprement le clavier iOS/Android sur inputs/textareas.
// — Ajoute un padding-bottom dynamique au body quand le clavier est ouvert
//   pour que le contenu puisse scroll au-dessus du clavier
// — Scrolle automatiquement l'élément focusé au-dessus du clavier
// — Empêche le password / email caché sous le clavier sur Login / Register / etc.
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

export function useIOSKeyboardScroll() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let keyboardHeight = 0;

    const setBodyPadding = (height) => {
      try {
        document.body.style.paddingBottom = height ? `${height}px` : '';
      } catch (_) {}
    };

    const scrollFocusedIntoView = () => {
      const el = document.activeElement;
      if (!el) return;
      const tag = (el.tagName || '').toUpperCase();
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;

      // Attend que le clavier soit visible + body resized
      setTimeout(() => {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (_) {}
      }, 150);
    };

    let showHandle, hideHandle;
    (async () => {
      showHandle = await Keyboard.addListener('keyboardWillShow', (info) => {
        keyboardHeight = info?.keyboardHeight || 0;
        setBodyPadding(keyboardHeight);
        scrollFocusedIntoView();
      });
      hideHandle = await Keyboard.addListener('keyboardWillHide', () => {
        keyboardHeight = 0;
        setBodyPadding(0);
      });
    })();

    // Fallback : écoute aussi les focus d'inputs
    const onFocusIn = () => scrollFocusedIntoView();
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      setBodyPadding(0);
      try { showHandle && showHandle.remove(); } catch (_) {}
      try { hideHandle && hideHandle.remove(); } catch (_) {}
    };
  }, []);
}
