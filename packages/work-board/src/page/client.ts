export const client = `
import { renderDiagrams } from "/_board/diagrams.js";
import { remember, swap } from "/_board/swap.js";

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
  try {
    const response = await fetch(location.pathname, { cache: "no-store" });
    const next = new DOMParser().parseFromString(await response.text(), "text/html");
    const files = next.getElementById("files");
    const doc = next.getElementById("doc");
    if (files === null || doc === null) {
      failure = "refresh failed (" + response.status + ")";
      return;
    }
    failure = "";
    swap(document.getElementById("files"), files);
    swap(document.getElementById("doc"), doc);
    document.title = next.title;
    tick();
    renderDiagrams(document);
  } catch {
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

tick();
setInterval(tick, 5000);
renderDiagrams(document);
`;
