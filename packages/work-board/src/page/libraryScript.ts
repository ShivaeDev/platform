export function libraryScript(): string {
	return `
const root = document.documentElement;
const key = "work-board:library:" + root.dataset.workspace;
const library = document.getElementById("reading-library");
let favorites = [];
let recents = [];
let notice = "";
const valid = (items) => Array.isArray(items) ? items.filter((item) => item && typeof item.file === "string" && item.file !== "" && typeof item.title === "string") : [];
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
  favorites = valid(saved?.favorites);
  recents = valid(saved?.recents);
} catch { notice = "Reading history applies to this page only."; }
const save = () => {
  try { localStorage.setItem(key, JSON.stringify({ favorites, recents })); notice = ""; }
  catch { notice = "Reading history applies to this page only."; }
};
const hrefOf = (file) => "/" + file.split("/").map(encodeURIComponent).join("/");
const list = (title, items) => {
  const heading = document.createElement("h2");
  heading.className = "nav-heading";
  heading.textContent = title;
  const ul = document.createElement("ul");
  const available = new Set([...document.querySelectorAll("#files a")].map((a) => new URL(a.href).pathname));
  for (const item of items) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = hrefOf(item.file);
    a.textContent = item.title;
    if (item.file === document.getElementById("doc").dataset.file) a.setAttribute("aria-current", "page");
    if (!available.has(a.pathname)) {
      a.textContent += " (missing)";
      a.className = "missing";
    }
    li.append(a); ul.append(li);
  }
  return [heading, ul];
};
export const refreshLibrary = (visit = false) => {
  const doc = document.getElementById("doc");
  const title = doc.querySelector("h1")?.textContent.trim() || doc.dataset.file;
  document.title = title ? title + " · Work Board" : "Work Board";
  const active = document.querySelector('#files a[aria-current="page"]');
  if (active) active.title = title;
  const toggle = document.getElementById("favorite-toggle");
  if (toggle) {
    const saved = favorites.some((item) => item.file === doc.dataset.file);
    toggle.disabled = false;
    toggle.setAttribute("aria-pressed", String(saved));
    toggle.textContent = saved ? "Remove favorite" : "Save favorite";
    if (visit) {
      recents = [{ file: doc.dataset.file, title }, ...recents.filter((item) => item.file !== doc.dataset.file)].slice(0, 10);
      save();
    }
  }
  const status = document.createElement("p");
  status.className = "library-status";
  status.setAttribute("role", "status");
  status.textContent = notice;
  library.replaceChildren(...(favorites.length ? list("Favorites", favorites) : []), ...(recents.length ? list("Recent documents", recents) : []), ...(notice ? [status] : []));
  library.hidden = favorites.length === 0 && recents.length === 0 && notice === "";
};
document.addEventListener("click", (event) => {
  if (!event.target.closest?.("#favorite-toggle")) return;
  const doc = document.getElementById("doc");
  const file = doc.dataset.file;
  favorites = favorites.some((item) => item.file === file) ? favorites.filter((item) => item.file !== file) : [...favorites, { file, title: doc.querySelector("h1")?.textContent.trim() || file }];
  save(); refreshLibrary();
});
`;
}
