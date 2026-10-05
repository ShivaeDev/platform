export function historyScript(): string {
	return `
import { swap, remember } from "/_board/swap.js";
import { captureReading, restoreReading } from "/_board/reading-state.js";
const key = "work-board:changes:" + document.documentElement.dataset.workspace;
let memory;
let storageNotice = "";
let unavailableHtml = "";
let generation = 0;
let controller;
const baseline = () => {
 if (memory !== undefined) return memory;
 try { return localStorage.getItem(key); }
 catch { memory = null; storageNotice = "Browser storage unavailable; history applies to this page only."; return memory; }
};
const forget = () => {
 memory = null;
 try { localStorage.removeItem(key); memory = undefined; }
 catch { storageNotice = "Cleared for this page, but browser storage could not be cleared. Reload may restore older data."; }
};
const keep = (raw) => {
 memory = raw;
 try { localStorage.setItem(key, raw); memory = undefined; storageNotice = ""; }
 catch {
  storageNotice = "Snapshot remembered for this page only; browser storage is unavailable.";
  try { localStorage.removeItem(key); }
  catch { storageNotice += " Reload may restore older data."; }
 }
};
const controls = (available, busy = false) => {
 const mark = document.getElementById("history-mark");
 const clear = document.getElementById("history-clear");
 if (!mark || !clear) return;
 const exists = baseline() !== null;
 mark.textContent = exists ? "Mark current workspace seen" : "Start remembering changes";
 mark.disabled = busy || !available;
 clear.disabled = busy || !exists;
 document.getElementById("history-storage").textContent = storageNotice;
};
const render = (html) => {
 const content = document.getElementById("changes-content");
 if (!content) return;
 const reading = captureReading();
 const next = content.cloneNode(false);
 next.innerHTML = html;
 swap(content, next);
 remember(content);
 restoreReading({ ...reading, selection: null }, false);
};
const query = async (action) => {
 const mine = ++generation;
 controller?.abort();
 controller = new AbortController();
 const raw = baseline();
 const response = await fetch("/_board/history", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ action, baseline: raw }), signal: controller.signal, cache: "no-store",
 });
 if (!response.ok) throw new Error("History query failed");
 const result = await response.json();
 if (mine !== generation) return null;
 if (result.discardBaseline && baseline() === raw) { forget(); unavailableHtml = result.html; }
 return result;
};
const refresh = async () => {
 const visible = document.getElementById("doc")?.dataset.view === "changes";
 try {
  const result = await query(visible ? "compare" : "check");
  if (!result) return;
  if (visible && document.getElementById("doc")?.dataset.view === "changes") {
   render(baseline() === null && unavailableHtml ? unavailableHtml : result.html);
   controls(result.snapshot !== null);
  }
 } catch (error) {
  if (error.name === "AbortError") return;
  if (visible) {
   render("<p>History is unavailable: the current observation could not be loaded. No comparison or removals are inferred.</p>");
   controls(false);
  }
 }
};
document.addEventListener("click", async (event) => {
 if (event.target.closest?.("#history-clear")) {
  ++generation;
  controller?.abort();
  forget();
  unavailableHtml = "";
  await refresh();
 }
 if (event.target.closest?.("#history-mark")) {
  controls(false, true);
  try {
   const result = await query("observe");
   if (!result) return;
   if (result.snapshot === null) { render(result.html); controls(false); return; }
   keep(result.snapshot);
   unavailableHtml = "";
   await refresh();
  } catch (error) {
   if (error.name !== "AbortError") { render("<p>Could not remember the current observation. Your previous baseline is preserved.</p>"); controls(false); }
  }
 }
});
document.addEventListener("board-page", refresh);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
window.addEventListener("storage", (event) => {
 if (event.key === key || event.key === null) { memory = undefined; storageNotice = ""; unavailableHtml = ""; refresh(); }
});
setInterval(() => { if (baseline() !== null) refresh(); }, 60000);
refresh();
`;
}
