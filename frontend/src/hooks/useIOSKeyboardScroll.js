// Hook : gère proprement le clavier iOS/Android sur inputs/textareas.
// — Expose une CSS variable --kolo-keyboard-height sur :root
// — Ajoute un padding-bottom dynamique au body quand le clavier est ouvert
// — Scrolle automatiquement l'élément focusé au-dessus du clavier
// — Fonctionne dans les modals/bottom-sheets (position: fixed) grâce à
//   la CSS var que les modals peuvent utiliser pour leur propre padding-bottom
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

export function useIOSKeyboardScroll() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setKeyboardHeight = (height) => {
      try {
        document.documentElement.style.setProperty('--kolo-keyboard-height', `${height}px`);
        document.body.style.paddingBottom = height ? `${height}px` : '';
        if (height > 0) {
          document.documentElement.classList.add('kolo-keyboard-open');
        } else {
          document.documentElement.classList.remove('kolo-keyboard-open');
        }
      } catch (_) {}
    };

    const scrollFocusedIntoView = () => {
      const el = document.activeElement;
      if (!el) return;
      const tag = (el.tagName || '').toUpperCase();
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;

      // Wait for keyboard to be visible + layout to update
      setTimeout(() => {
        try {
          // scrollIntoView scrolls all ancestor scroll containers (including
          // modal bodies with overflow-y: auto) so it works in bottom sheets.
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch (_) {}
      }, 200);
    };

    // Initialize CSS var
    setKeyboardHeight(0);

    let showHandle, hideHandle;
    (async () => {
      showHandle = await Keyboard.addListener('keyboardWillShow', (info) => {
        setKeyboardHeight(info?.keyboardHeight || 0);
        scrollFocusedIntoView();
      });
      hideHandle = await Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardHeight(0);
      });
    })();

    // Fallback: refocus → rescroll (covers cases where focus moves between inputs)
    const onFocusIn = () => scrollFocusedIntoView();
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      setKeyboardHeight(0);
      try { showHandle && showHandle.remove(); } catch (_) {}
      try { hideHandle && hideHandle.remove(); } catch (_) {}
    };
  }, []);
}
