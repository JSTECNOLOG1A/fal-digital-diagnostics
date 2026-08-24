import { useRef, useCallback } from 'react';

/**
 * scrollToRef — rola até um elemento dentro de qualquer scroll container.
 * Funciona mesmo quando o scroll está num <main> interno (não no window).
 */
export function scrollToRef(ref, offsetPx = 16) {
  if (!ref?.current) return;
  let el = ref.current;
  let scrollParent = null;
  while (el.parentElement) {
    el = el.parentElement;
    const { overflow, overflowY } = window.getComputedStyle(el);
    if (/(auto|scroll)/.test(overflow + overflowY)) { scrollParent = el; break; }
  }
  if (scrollParent) {
    const targetTop = ref.current.getBoundingClientRect().top
      - scrollParent.getBoundingClientRect().top
      + scrollParent.scrollTop
      - offsetPx;
    scrollParent.scrollTo({ top: targetTop, behavior: 'smooth' });
  } else {
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * useTabScroll — hook para trocar abas com scroll automático para o conteúdo.
 *
 * Uso:
 *   const { tabContentRef, goToTab } = useTabScroll();
 *   <div ref={tabContentRef} />   ← ancora antes do conteúdo
 *   onClick={() => goToTab('nome', setTab)}
 */
export function useTabScroll() {
  const tabContentRef = useRef(null);

  const goToTab = useCallback((key, setTab) => {
    setTab(key);
    setTimeout(() => scrollToRef(tabContentRef), 60);
  }, []);

  return { tabContentRef, goToTab };
}