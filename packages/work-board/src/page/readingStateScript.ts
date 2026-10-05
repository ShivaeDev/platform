export function readingStateScript(): string {
	return `
const pathOf = (node, root) => {
  const path = [];
  for (; node !== root; node = node.parentNode) {
    if (!node?.parentNode) return null;
    path.unshift([...node.parentNode.childNodes].indexOf(node));
  }
  return path;
};
const nodeAt = (path, root) => path.reduce((node, index) => node?.childNodes[index], root);

export const captureReading = () => {
  const root = document.getElementById("doc");
  const selection = document.getSelection();
  const anchor = selection?.anchorNode && pathOf(selection.anchorNode, root);
  const focus = selection?.focusNode && pathOf(selection.focusNode, root);
  return {
    scroll: [scrollX, scrollY],
    sidebar: document.getElementById("sidebar").scrollTop,
    details: [...root.querySelectorAll("details")].map((detail) => detail.open),
    selection: anchor && focus ? { anchor, focus, a: selection.anchorOffset, f: selection.focusOffset } : null,
  };
};

export const restoreReading = (state, restoreDetails = true) => {
  if (!state || !Array.isArray(state.scroll) || state.scroll.length !== 2 || !state.scroll.every(Number.isFinite)) return;
  const root = document.getElementById("doc");
  [...root.querySelectorAll("details")].forEach((detail, index) => {
    if (restoreDetails && typeof state.details?.[index] === "boolean") detail.open = state.details[index];
  });
  document.getElementById("sidebar").scrollTop = state.sidebar ?? 0;
  const saved = state.selection;
  if (saved && Array.isArray(saved.anchor) && Array.isArray(saved.focus) && Number.isInteger(saved.a) && Number.isInteger(saved.f) && saved.a >= 0 && saved.f >= 0) {
    const anchor = nodeAt(saved.anchor, root);
    const focus = nodeAt(saved.focus, root);
    const limit = (node) => node.nodeType === 3 ? node.textContent.length : node.childNodes.length;
    if (anchor && focus) document.getSelection()?.setBaseAndExtent(anchor, Math.min(saved.a, limit(anchor)), focus, Math.min(saved.f, limit(focus)));
  }
  scrollTo(...state.scroll);
};

const passageAt = (hash) => {
  try { return document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return null; }
};
export const reportMissingPassage = () => {
  if (!location.hash || !document.getElementById("favorite-toggle")) return;
  const status = document.getElementById("navigation-status");
  if (!passageAt(location.hash)) status.textContent = "This passage is no longer in the document.";
  else if (status.textContent === "This passage is no longer in the document.") status.textContent = "";
};
export const scrollToPassage = (hash) => {
  if (!hash) { scrollTo(0, 0); return; }
  const target = passageAt(hash);
  if (!target) { reportMissingPassage(); return; }
  for (let parent = target.parentElement; parent; parent = parent.parentElement) if (parent.tagName === "DETAILS") parent.open = true;
  target.scrollIntoView();
  target.focus({ preventScroll: true });
};
`;
}
