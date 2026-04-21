// Hook : gère proprement le clavier iOS/Android sur inputs/textareas.
// — Expose CSS var --kolo-keyboard-height + class "kolo-keyboard-open" sur <html>
// — Padding-bottom dynamique au body (pour pages scrollables)
// — Padding-bottom dynamique aux modals fixes (via CSS rule dans App.css)
// — OVERRIDE inline style: si l'input focusé est dans un container centré
//   verticalement (alignItems: center), on le bascule en flex-start pour
//   que le contenu remonte quand le clavier est ouvert
// — scrollIntoView de l'input focusé
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

// Mémorise les styles qu'on override pour pouvoir les restaurer au hide
const overridden = [];

function findCenteredAncestor(el) {
  let node = el?.parentElement;
  while (node && node !== document.body) {
    const cs = window.getComputedStyle(node);
    if (cs.display === 'flex' && cs.alignItems === 'center') {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function overrideCenteredContainer() {
  const el = document.activeElement;
  if (!el) return;
  const tag = (el.tagName || '').toUpperCase();
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return;

  const container = findCenteredAncestor(el);
  if (!container) return;
  if (overridden.some((o) => o.el === container)) return; // déjà override

  overridden.push({
    el: container,
    prevAlignItems: container.style.alignItems,
    prevJustifyContent: container.style.justifyContent,
    prevPaddingTop: container.style.paddingTop,
  });
  container.style.alignItems = 'flex-start';
  container.style.justifyContent = 'flex-start';
  // Garde un peu d'air en haut pour pas coller au top
  if (!container.style.paddingTop || parseInt(container.style.paddingTop, 10) < 40) {
    container.style.paddingTop = '60px';
  }
}

function restoreCenteredContainers() {
  while (overridden.length) {
    const { el, prevAlignItems, prevJustifyContent, prevPaddingTop } = overridden.pop();
    try {
      el.style.alignItems = prevAlignItems || '';
      el.style.justifyContent = prevJustifyContent || '';
      el.style.paddingTop = prevPaddingTop || '';
    } catch (_) {}
  }
}

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

      setTimeout(() => {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        } catch (_) {}
      }, 220);
    };

    setKeyboardHeight(0);

    let showHandle, hideHandle;
    (async () => {
      showHandle = await Keyboard.addListener('keyboardWillShow', (info) => {
        setKeyboardHeight(info?.keyboardHeight || 0);
        overrideCenteredContainer();
        scrollFocusedIntoView();
      });
      hideHandle = await Keyboard.addListener('keyboardWillHide', () => {
        setKeyboardHeight(0);
        restoreCenteredContainers();
      });
    })();

    const onFocusIn = () => {
      overrideCenteredContainer();
      scrollFocusedIntoView();
    };
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('focusin', onFocusIn);
      setKeyboardHeight(0);
      restoreCenteredContainers();
      try { showHandle && showHandle.remove(); } catch (_) {}
      try { hideHandle && hideHandle.remove(); } catch (_) {}
    };
  }, []);
}
