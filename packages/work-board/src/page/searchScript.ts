export function searchScript(): string {
	return `
import { activate, matchingCommands, move, showResults } from "/_board/search-results.js";
const dialog = document.getElementById("search-dialog");
const input = document.getElementById("search-query");
const status = document.getElementById("search-status");
const open = document.getElementById("search-open");
open.disabled = false;
let previous;
let version = 0;
let timer;
let controller;
const invalidate = () => {
 ++version;
 clearTimeout(timer);
 controller?.abort();
};
const search = async () => {
 invalidate();
 const mine = version;
 const query = input.value.trim();
 const commands = matchingCommands(query);
 showResults(commands);
 if (!query) { status.textContent = "Type to search this workspace, or choose a command."; return; }
 status.textContent = "Searching…";
 controller = new AbortController();
 try {
  const response = await fetch("/_board/search?q=" + encodeURIComponent(query), { cache: "no-store", signal: controller.signal });
  if (!response.ok) throw new Error("Search unavailable");
  const body = await response.json();
  if (mine !== version || !dialog.open) return;
  showResults([...commands, ...body.results]);
  status.textContent = (body.total ? (body.total > body.results.length ? "Showing " + body.results.length + " of " : "") + body.total + " matches." : "No document matches.") + (body.unavailable.length ? " Could not read " + body.unavailable.length + " files; results are incomplete." : "");
 } catch (error) {
  if (mine !== version || error.name === "AbortError") return;
  status.textContent = "Search could not be completed. Press Search to retry.";
 }
};
open.addEventListener("click", () => {
 previous = document.activeElement;
 dialog.showModal();
 input.focus();
 input.select();
 search();
});
document.getElementById("search-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => { invalidate(); previous?.focus({ preventScroll: true }); });
dialog.addEventListener("cancel", () => invalidate());
dialog.addEventListener("keydown", (event) => {
 if (event.key === "Escape") { event.preventDefault(); dialog.close(); }
});
input.addEventListener("input", () => {
 invalidate();
 showResults([]);
 status.textContent = input.value.trim() ? "Searching…" : "Type to search this workspace.";
 timer = setTimeout(search, 150);
});
document.getElementById("search-form").addEventListener("submit", (event) => { event.preventDefault(); search(); });
input.addEventListener("keydown", (event) => {
 if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); move(event.key === "ArrowDown" ? 1 : -1); }
 if (event.key === "Enter" && document.querySelector('#search-results a[aria-selected="true"]')) { event.preventDefault(); activate(); }
});
document.addEventListener("keydown", (event) => {
 if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "k") {
  event.preventDefault();
  if (dialog.open) dialog.close(); else open.click();
 }
});
document.addEventListener("board-index-change", () => { if (dialog.open) search(); });
`;
}
