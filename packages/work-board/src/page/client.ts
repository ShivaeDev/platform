export const client = `
import "/_board/preferences.js";
import { renderDiagrams } from "/_board/diagrams.js";
import { applyPage } from "/_board/page-state.js";
import { pageVersion } from "/_board/navigation.js";
import { remember } from "/_board/swap.js";

const since = (modified) => {
  const seconds = Math.max(0, Math.round((Date.now() - modified) / 1000));
  if (seconds < 60) return seconds + "s";
  if (seconds < 3600) return Math.round(seconds / 60) + "m";
  if (seconds < 172800) return Math.round(seconds / 3600) + "h";
  return Math.round(seconds / 86400) + "d";
};

const tick = () => {
  for (const age of document.querySelectorAll("[data-modified]")) {
    const ago = since(Number(age.dataset.modified));
    age.textContent = age.classList.contains("short") ? ago : "updated " + ago + " ago";
  }
};

remember(document.getElementById("files"));
remember(document.getElementById("doc"));

const live = document.getElementById("live");
let connected = false;
let dropped = true;
let failure = "";

const show = () => {
  const state = failure !== "" ? "stale" : connected ? "live" : "down";
  live.dataset.state = state;
  live.textContent = failure !== "" ? failure : connected ? "live" : "reconnecting";
};

const load = async () => {
  const version = pageVersion();
  const path = location.pathname + location.search;
  try {
    const response = await fetch(path, { cache: "no-store" });
    const next = new DOMParser().parseFromString(await response.text(), "text/html");
    const files = next.getElementById("files");
    const doc = next.getElementById("doc");
    if (version !== pageVersion()) return;
    if (files === null || doc === null) {
      failure = "refresh failed (" + response.status + ")";
      return;
    }
    failure = "";
    applyPage(next, true);
    tick();
  } catch {
    if (version !== pageVersion()) return;
    failure = "refresh failed";
  }
};

let loading = false;
let dirty = false;
const refresh = async () => {
  if (loading) {
    dirty = true;
    return;
  }
  loading = true;
  do {
    dirty = false;
    await load();
  } while (dirty);
  loading = false;
  show();
};

const events = new EventSource("/events");
events.addEventListener("ready", () => {
  connected = true;
  show();
  if (dropped) refresh();
  dropped = false;
});
const down = () => {
  connected = false;
  dropped = true;
  show();
};
events.addEventListener("change", refresh);
events.addEventListener("down", down);
events.addEventListener("error", down);

document.addEventListener("board-page", tick);
tick();
setInterval(tick, 5000);
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
