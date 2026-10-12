import { itemContextScript } from "./itemContextScript.ts";
import { preferencesScript } from "./preferencesScript.ts";
import { routeQueryOptions } from "./routeQuery.ts";

export const client = `
import "/_board/diagnostics.js";
import "/_board/saved-views.js";
import "/_board/history.js";
import "/_board/preferences.js";
import "/_board/search.js";
import { tick } from "/_board/ages.js";
import { renderDiagrams } from "/_board/diagrams.js";
import { applyNavigation, applyPage } from "/_board/page-state.js";
import "/_board/navigation.js";
import { remember, swap } from "/_board/swap.js";
import { refreshLibrary } from "/_board/library.js";
import { revealCurrentFile } from "/_board/sidebar.js";
import { resolvedDocumentFailure, session } from "/_board/native.js";

document.documentElement.dataset.js = "true";
${itemContextScript()}
remember(document.getElementById("doc"));
let native = session(window);
const live = document.getElementById("live");
const toggle = document.getElementById("updates-toggle");
let pageFailure = "";
let navFailure = "";
let pageWaiting = true;
let watching = false;
let navWaiting = true;
let active = "";
let releasePage;
let selected;
let releaseNavigation;
const show = () => {
  const state = native.registry.get(native.updates.status);
  const paused = native.registry.get(native.updates.paused);
  const failure = pageFailure || navFailure;
  live.dataset.state = paused ? "paused" : failure ? "stale" : !watching || state.connection !== "live" ? "down" : pageWaiting || navWaiting ? "refreshing" : "live";
  live.textContent = paused ? "updates paused · " + state.pending + (state.pending === 256 ? "+" : "") + " pending updates" : failure || (!watching || state.connection !== "live" ? "reconnecting" : pageWaiting || navWaiting ? "refreshing" : "live");
  toggle.textContent = paused ? "Resume updates" : "Pause updates";
  toggle.setAttribute("aria-pressed", String(paused));
  live.title = "Connection: " + state.connection + "; last observed source watcher: " + (watching ? "watching" : "unavailable") + "; " + (paused ? "automatic reads paused" : pageWaiting || navWaiting ? "reads pending" : failure ? "showing retained source" : "reads settled");
};
const watchNavigation = () => {
  const doc = document.getElementById("doc");
  const current = doc.dataset.view ? "" : doc.dataset.file;
  if (current === selected) return;
  selected = current;
  releaseNavigation?.();
  releaseNavigation = native.registry.subscribe(native.api.navigation.query({ current }), (value) => {
    navWaiting = value.waiting || value._tag === "Initial";
    if (value._tag === "Failure") navFailure = "navigation refresh failed";
    if (value._tag === "Success" && !value.waiting) {
      navFailure = "";
      if (!document.querySelector("[data-board-react-root]")) applyNavigation(value.value);
    }
    show();
  }, { immediate: true });
};
const watchPage = () => {
  watchNavigation();
  const doc = document.getElementById("doc");
  const path = location.pathname + location.search;
  const selection = path + (doc.hasAttribute("data-react-document") ? ":document" : ":page");
  if (selection === active) return;
  active = selection;
  releasePage?.();
  pageFailure = "";
  const atom = doc.hasAttribute("data-react-document") ? native.api.document.query({ url: path }, ${JSON.stringify(routeQueryOptions)}) : native.api.page.query({ url: path }, ${JSON.stringify(routeQueryOptions)});
  releasePage = native.registry.subscribe(atom, (value) => {
    pageWaiting = value.waiting || value._tag === "Initial";
    if (value._tag === "Failure") pageFailure = resolvedDocumentFailure(value.cause) ? "" : "refresh failed";
    if (value._tag === "Success" && !value.waiting && active === selection && path === location.pathname + location.search) {
      if (document.querySelector("[data-board-react-root]")) { pageFailure = ""; show(); return; }
      const next = new DOMParser().parseFromString(value.value.html, "text/html");
      pageFailure = applyPage(next, true) ? "" : "refresh failed";
      tick();
    }
    show();
  }, { immediate: true });
};
const observe = () => {
native.registry.subscribe(native.api.watcher.query(), (value) => {
  watching = value._tag === "Success" && value.value.watching;
  show();
}, { immediate: true });
native.registry.subscribe(native.updates.status, show);
native.registry.subscribe(native.updates.paused, (paused) => { show(); if (!paused) document.dispatchEvent(new Event("board-updates-resumed")); });
};
document.addEventListener("board-page", () => { tick(); renderDiagrams(document); refreshLibrary(); });
document.addEventListener("board-index-change", () => { tick(); refreshLibrary(); revealCurrentFile(); });
observe();
toggle.disabled = false;
toggle.addEventListener("click", () => native.registry.set(native.updates.paused, !native.registry.get(native.updates.paused)));
document.addEventListener("board-page", watchPage);
watchPage();
window.addEventListener("pagehide", () => { releasePage?.(); releaseNavigation?.(); selected = undefined; active = ""; });
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  native = session(window);
  pageWaiting = navWaiting = true;
  watching = false;
  pageFailure = navFailure = "";
  observe();
  watchPage();
});

renderDiagrams(document);
`;
export const preferences = preferencesScript();
