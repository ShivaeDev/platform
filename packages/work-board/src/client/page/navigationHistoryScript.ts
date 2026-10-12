export function navigationHistoryScript(): string {
	return `
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
let displayedRoute = location.pathname + location.search;
let version = 0;
let controller;
export const pageVersion = () => version;
const stateWith = (id, reading = null) => ({ ...history.state, workBoard: { id, reading } });
history.replaceState(stateWith(displayedId, history.state?.workBoard?.reading), "");
history.scrollRestoration = "manual";
document.getElementById("doc").dataset.scheme = document.documentElement.dataset.scheme;
refreshLibrary(true);
revealCurrentFile(true);
document.getElementById("home-open").setAttribute("aria-current", location.pathname === "/" ? "page" : "false");
const initialReading = savedReading[displayedId] ?? history.state.workBoard.reading;
requestAnimationFrame(() => {
  if (initialReading) restoreReading(initialReading);
  else scrollToPassage(location.hash);
  reportMissingPassage();
});

const saveCurrent = (write = true) => {
  if (router && document.getElementById("doc")?.dataset.route !== displayedRoute) return;
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

`;
}
