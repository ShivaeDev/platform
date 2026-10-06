export const client = `
import "/_board/saved-views.js";
import "/_board/history.js";
import "/_board/preferences.js";
import "/_board/search.js";
import { tick } from "/_board/ages.js";
import { renderDiagrams } from "/_board/diagrams.js";
import { applyPage } from "/_board/page-state.js";
import "/_board/navigation.js";
import { remember, swap } from "/_board/swap.js";
import { refreshLibrary } from "/_board/library.js";
import { session } from "/_board/native.js";


document.documentElement.dataset.js = "true";
remember(document.getElementById("files"));
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
const watchPage = () => {
  const path = location.pathname + location.search;
  if (path === active) return;
  active = path;
  releasePage?.();
  pageFailure = "";
  const atom = native.api.page.query({ url: path });
  releasePage = native.registry.subscribe(atom, (value) => {
    pageWaiting = value.waiting || value._tag === "Initial";
    if (value._tag === "Failure") pageFailure = "refresh failed";
    if (value._tag === "Success" && !value.waiting && active === location.pathname + location.search) {
      const next = new DOMParser().parseFromString(value.value.html, "text/html");
      pageFailure = applyPage(next, true) ? "" : "refresh failed";
      tick();
    }
    show();
  }, { immediate: true });
};
const observe = () => {
native.registry.subscribe(native.api.navigation.query(), (value) => {
  navWaiting = value.waiting || value._tag === "Initial";
  if (value._tag === "Failure") navFailure = "navigation refresh failed";
  if (value._tag === "Success" && !value.waiting) {
    navFailure = "";
    const files = document.getElementById("files");
    const next = files.cloneNode(false);
    next.innerHTML = value.value;
    const current = document.getElementById("doc").dataset.file;
    for (const link of next.querySelectorAll("a")) if (decodeURIComponent(new URL(link.href, location.href).pathname.slice(1)) === current) link.setAttribute("aria-current", "page");
    swap(files, next);
    refreshLibrary();
    tick();
    document.dispatchEvent(new Event("board-index-change"));
  }
  show();
}, { immediate: true });
native.registry.subscribe(native.api.watcher.query(), (value) => {
  watching = value._tag === "Success" && value.value.watching;
  show();
}, { immediate: true });
native.registry.subscribe(native.updates.status, show);
native.registry.subscribe(native.updates.paused, (paused) => { show(); if (!paused) document.dispatchEvent(new Event("board-updates-resumed")); });
};
observe();
toggle.disabled = false;
toggle.addEventListener("click", () => native.registry.set(native.updates.paused, !native.registry.get(native.updates.paused)));
document.addEventListener("board-page", watchPage);
watchPage();
window.addEventListener("pagehide", () => { releasePage?.(); active = ""; });
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
export const preferences = `
const root = document.documentElement;
const key = "work-board:appearance:" + root.dataset.workspace;
const theme = document.getElementById("theme");
const density = document.getElementById("density");
const sidebar = document.getElementById("sidebar");
const toggle = document.getElementById("sidebar-toggle");
const status = document.getElementById("preference-status");
const system = matchMedia("(prefers-color-scheme: dark)");
let saved = {};
try {
  const value = JSON.parse(localStorage.getItem(key) ?? "{}");
  if (value !== null && typeof value === "object" && !Array.isArray(value)) saved = value;
} catch {
  status.textContent = "Preferences apply to this page only.";
}

theme.value = ["light", "dark"].includes(saved.theme) ? saved.theme : "system";
density.value = saved.density === "compact" ? "compact" : "comfortable";
let closed = typeof saved.closed === "boolean" ? saved.closed : matchMedia("(max-width: 760px)").matches;

const appearance = () => {
  root.dataset.theme = theme.value;
  root.dataset.scheme = theme.value === "system" ? (system.matches ? "dark" : "light") : theme.value;
  root.dataset.density = density.value;
  root.dataset.sidebar = closed ? "closed" : "open";
  sidebar.hidden = closed;
  toggle.setAttribute("aria-expanded", String(!closed));
  document.dispatchEvent(new Event("board-theme"));
};

const save = () => {
  appearance();
  try {
    localStorage.setItem(key, JSON.stringify({ theme: theme.value, density: density.value, closed }));
    status.textContent = "";
  } catch {
    status.textContent = "Preferences apply to this page only.";
  }
};

theme.addEventListener("change", save);
density.addEventListener("change", save);
toggle.addEventListener("click", () => {
  closed = !closed;
  save();
});
system.addEventListener("change", appearance);
appearance();
`;
