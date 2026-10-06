export function navigationScript(): string {
	return `
import { applyPage, capturePage } from "/_board/page-state.js";
import { reportMissingPassage, restoreReading, scrollToPassage } from "/_board/reading-state.js";
import { refreshLibrary } from "/_board/library.js";
import { session } from "/_board/native.js";

const cache = new Map();
const readingKey = "work-board:reading:" + document.documentElement.dataset.workspace;
let savedReading = {};
try {
  const saved = JSON.parse(sessionStorage.getItem(readingKey) ?? "{}");
  if (saved && typeof saved === "object" && !Array.isArray(saved)) savedReading = saved;
} catch {}
let count = 0;
const newId = () => Date.now() + "-" + ++count;
let displayedId = history.state?.workBoard?.id ?? newId();
let version = 0;
let controller;
export const pageVersion = () => version;
const stateWith = (id, reading = null) => ({ ...history.state, workBoard: { id, reading } });
history.replaceState(stateWith(displayedId, history.state?.workBoard?.reading), "");
history.scrollRestoration = "manual";
document.getElementById("doc").dataset.scheme = document.documentElement.dataset.scheme;
refreshLibrary(true);
const initialReading = savedReading[displayedId] ?? history.state.workBoard.reading;
requestAnimationFrame(() => {
  if (initialReading) restoreReading(initialReading);
  else scrollToPassage(location.hash);
  reportMissingPassage();
});

const saveCurrent = (write = true) => {
  const snapshot = capturePage();
  cache.delete(displayedId);
  cache.set(displayedId, snapshot);
  delete savedReading[displayedId];
  savedReading[displayedId] = snapshot.reading;
  savedReading = Object.fromEntries(Object.entries(savedReading).slice(-30));
  try { sessionStorage.setItem(readingKey, JSON.stringify(savedReading)); } catch {}
  if (cache.size > 30) cache.delete(cache.keys().next().value);
  if (write && history.state?.workBoard?.id === displayedId) history.replaceState(stateWith(displayedId, snapshot.reading), "");
};
window.addEventListener("pagehide", () => saveCurrent(false));

const navigate = async (target, entry) => {
  const sameDocument = document.getElementById("favorite-toggle") !== null && displayedId === history.state?.workBoard?.id && target.pathname === location.pathname && target.search === location.search;
  saveCurrent(!entry);
  const id = entry?.id ?? newId();
  if (!entry) history.pushState(stateWith(id), "", target);
  else if (history.state?.workBoard?.id !== id) history.replaceState(stateWith(id, entry.reading), "");
  const mine = ++version;
  controller?.abort();
  controller = new AbortController();
  const status = document.getElementById("navigation-status");
  status.textContent = "";
  if (!entry && sameDocument) {
    displayedId = id;
    scrollToPassage(target.hash);
    return;
  }
  const cached = cache.get(id);
  if (cached) {
    applyPage(cached.page);
    displayedId = id;
    restoreReading(cached.reading);
  } else status.textContent = "Opening document…";
  try {
    const native = session(window);
    const response = await native.read(native.api.page.query({ url: target.pathname + target.search }), controller.signal);
    const page = new DOMParser().parseFromString(response.html, "text/html");
    if (mine !== version) return;
    if (!applyPage(page, Boolean(cached))) throw new Error("Invalid page");
    displayedId = id;
    status.textContent = response.status < 400 ? "" : response.status === 404 ? "This document is missing or was renamed." : "This document could not be opened.";
    if (response.status < 400) reportMissingPassage();
    if (!cached) {
      document.getElementById("doc").focus({ preventScroll: true });
      if (savedReading[id] ?? entry?.reading) restoreReading(savedReading[id] ?? entry.reading);
      else scrollToPassage(target.hash);
    }
  } catch (error) {
    if (mine !== version || controller.signal.aborted) return;
    status.textContent = "Could not open this document. Retry the link or reload the page.";
  }
};
document.addEventListener("click", (event) => {
  const link = event.target.closest?.("a[href]");
  if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
  const target = new URL(link.href, location.href);
  if (target.origin !== location.origin || !(target.pathname === "/" || (target.pathname === "/_board/handoff" || target.pathname === "/_board/respond" || target.pathname === "/_board/start" || target.pathname === "/_board/changes" || target.pathname === "/_board/overview" || target.pathname === "/_board/work" || target.pathname.startsWith("/_board/item/")) || /\\.md$/i.test(target.pathname))) return;
  event.preventDefault();
  navigate(target);
});
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!form.matches?.("#work-filters")) return;
  event.preventDefault();
  const target = new URL(form.action, location.href);
  target.search = new URLSearchParams([...new FormData(form)].map(([key, value]) => [key, String(value)])).toString();
  navigate(target);
});
window.addEventListener("popstate", (event) => navigate(new URL(location.href), event.state?.workBoard ?? { id: newId() }));
`;
}
