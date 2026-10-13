import { activeQueryScript } from "./activeQueryScript.ts";
import { navigationHistoryScript } from "./navigationHistoryScript.ts";
import { reactNavigationScript } from "./reactNavigationScript.ts";

export function navigationScript(): string {
	return `
import { applyPage, capturePage } from "/_board/page-state.js";
import { reportMissingPassage, restoreReading, scrollToPassage } from "/_board/reading-state.js";
import { refreshLibrary } from "/_board/library.js";
import { revealCurrentFile } from "/_board/sidebar.js";
import { session } from "/_board/native.js";

${activeQueryScript()}
let router;
export const connectRouter = (control) => {
  router = control;
  router.before(() => saveCurrent(false));
  let resolved = location.href;
  router.subscribe(() => {
    if (location.href === resolved) return;
    const previous = new URL(resolved);
    const target = new URL(location.href);
    resolved = location.href;
    const entry = history.state?.workBoard;
    const id = entry?.id && entry.id !== displayedId ? entry.id : newId();
    const hashOnly = target.pathname === previous.pathname && target.search === previous.search;
    navigate(target, { ...entry, id, reading: id === entry?.id ? entry.reading : null }, hashOnly);
  });
};
const open = async (target) => {
  if (!router) return navigate(target);
  const sameRoute = target.href === location.href;
  saveCurrent();
  await router.navigate(target.pathname + target.search + target.hash);
  if (!sameRoute || target.href !== location.href) return;
  const native = session(window);
  const doc = document.getElementById("doc");
  const page = activeQuery(native, doc, target.pathname + target.search);
  if (native.registry.get(page)._tag === "Failure") {
    delete doc.dataset.route;
    native.registry.refresh(page);
    await navigate(target, history.state?.workBoard ?? { id: newId() });
  }
};
${navigationHistoryScript()}

${reactNavigationScript()}

const navigate = async (target, entry, hashOnly = false) => {
  const route = target.pathname + target.search;
  const sameDocument = route === displayedRoute;
  if (!router) saveCurrent(!entry);
  const id = entry?.id ?? newId();
  if (!entry) history.pushState(stateWith(id), "", target);
  else if (history.state?.workBoard?.id !== id) history.replaceState(stateWith(id, entry.reading), "");
  const mine = ++version;
  controller?.abort();
  controller = new AbortController();
  const status = document.getElementById("navigation-status");
  status.textContent = "";
  if (sameDocument && (!entry || hashOnly)) {
    displayedId = id;
    const reading = savedReading[id] ?? entry?.reading;
    if (reading) restoreReading(reading);
    else scrollToPassage(target.hash);
    return;
  }
  const cached = cache.get(id);
  if (cached && !router) {
    applyPage(cached.page);
    displayedId = id;
    displayedRoute = route;
    restoreReading(cached.reading);
  } else status.textContent = "Opening document…";
  try {
    if (router) { await navigateReact(route, mine, id, entry, cached, target, status); return; }
    const native = session(window);
    const response = await fetch(target, { signal: controller.signal });
    const page = new DOMParser().parseFromString(await response.text(), "text/html");
    if (mine !== version) return;
    if (!applyPage(page, Boolean(cached))) throw new Error("Invalid page");
    displayedId = id;
    displayedRoute = route;
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
  if (target.origin !== location.origin || !(target.pathname === "/" || target.pathname === "/_board/diagnostics" || target.pathname === "/_board/handoff" || target.pathname === "/_board/result" || target.pathname === "/_board/respond" || target.pathname === "/_board/start" || target.pathname === "/_board/changes" || target.pathname === "/_board/inbox" || target.pathname === "/_board/overview" || target.pathname === "/_board/work" || target.pathname.startsWith("/_board/item/") || /\\.md$/i.test(target.pathname))) return;
  event.preventDefault();
  document.dispatchEvent(new Event("board-navigate"));
  open(target);
});
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!form.matches?.("#work-filters")) return;
  event.preventDefault();
  const target = new URL(form.action, location.href);
  target.search = new URLSearchParams([...new FormData(form)].map(([key, value]) => [key, String(value)])).toString();
  open(target);
});
window.addEventListener("popstate", (event) => { if (!router) navigate(new URL(location.href), event.state?.workBoard ?? { id: newId() }); });
`;
}
