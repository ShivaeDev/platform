export function savedScript(): string {
	return `
const key = "work-board:views:" + document.documentElement.dataset.workspace;
let views = [];
let notice = "";
let selectedName = "";
const localUrl = (value) => {
  if (typeof value !== "string" || value.length > 8192) return null;
  try {
    const url = new URL(value, location.href);
    if (url.origin !== location.origin || url.pathname !== "/_board/work") return null;
    for (const name of [...url.searchParams.keys()]) {
      if (!["view", "board", "owner", "status", "q", "sort"].includes(name)) url.searchParams.delete(name);
    }
    return url.pathname + url.search;
  } catch { return null; }
};
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? "[]");
  if (Array.isArray(saved)) {
    for (const entry of saved) {
      const url = localUrl(entry?.url);
      if (!url || typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > 60 || views.some((view) => view.name === entry.name)) continue;
      views.push({ name: entry.name, url });
      if (views.length === 10) break;
    }
  }
} catch { notice = "Saved views could not be restored; new views apply to this page until saved."; }
const persist = () => {
  try { localStorage.setItem(key, JSON.stringify(views)); notice = ""; }
  catch { notice = "Saved views apply to this page only; browser storage is unavailable."; }
};
const selectedView = () => views.find((view) => view.name === document.getElementById("saved-view")?.value);
const showSelection = () => {
  const open = document.getElementById("open-saved-view");
  if (!open) return;
  const selected = selectedView();
  open.hidden = !selected;
  if (selected) open.href = selected.url; else open.removeAttribute("href");
  document.getElementById("remove-saved-view").disabled = !selected;
};
const option = (label, value) => {
  const node = document.createElement("option");
  node.textContent = label; node.value = value;
  return node;
};
const refresh = (chosen) => {
  const tools = document.getElementById("saved-work-views");
  if (!tools) return;
  const picker = document.getElementById("saved-view");
  const previous = chosen ?? selectedName;
  const labels = views.map((view) => view.name);
  if (JSON.stringify([...picker.options].slice(1).map((option) => option.value)) !== JSON.stringify(labels)) {
    picker.replaceChildren(option(views.length ? "Choose a saved view" : "No saved views", ""), ...views.map((view) => option(view.name, view.name)));
  }
  picker.value = views.some((view) => view.name === previous) ? previous : "";
  selectedName = picker.value;
  picker.disabled = views.length === 0;
  tools.querySelector('#save-work-view button').disabled = false;
  document.getElementById("clear-saved-views").disabled = views.length === 0;
  document.getElementById("saved-view-status").textContent = notice || "Save board, filters, sort, and layout locally. Up to 10 named views; saving the same name updates it. Item selection stays in the URL.";
  showSelection();
};
document.addEventListener("submit", (event) => {
  if (!event.target.matches?.("#save-work-view")) return;
  event.preventDefault();
  const name = document.getElementById("view-name").value.trim().slice(0, 60);
  const url = localUrl(document.getElementById("saved-work-views").dataset.url);
  if (!name || !url) return;
  if (views.length === 10 && !views.some((view) => view.name === name)) {
    notice = "You have 10 saved views. Remove one or update an existing name."; refresh(); return;
  }
  views = [{ name, url }, ...views.filter((view) => view.name !== name)];
  persist(); refresh(name);
});
document.addEventListener("change", (event) => {
  if (event.target.id === "saved-view") { selectedName = event.target.value; showSelection(); }
});
document.addEventListener("click", (event) => {
  if (event.target.id === "remove-saved-view") views = views.filter((view) => view.name !== selectedView()?.name);
  else if (event.target.id === "clear-saved-views") views = [];
  else return;
  persist(); refresh();
});
document.addEventListener("board-page", () => refresh());
refresh();
`;
}
