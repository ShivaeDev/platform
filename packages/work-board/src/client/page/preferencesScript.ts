export function preferencesScript(): string {
	return `
import { setupSidebar } from "/_board/sidebar.js";
const root = document.documentElement;
const key = "work-board:appearance:" + root.dataset.workspace;
const theme = document.getElementById("theme");
const density = document.getElementById("density");
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
const sidebar = setupSidebar(typeof saved.closed === "boolean" && saved.closed);

const appearance = () => {
  root.dataset.theme = theme.value;
  root.dataset.scheme = theme.value === "system" ? (system.matches ? "dark" : "light") : theme.value;
  root.dataset.density = density.value;
  document.dispatchEvent(new Event("board-theme"));
};

const save = () => {
  appearance();
  try {
    localStorage.setItem(key, JSON.stringify({ theme: theme.value, density: density.value, closed: sidebar.closed() }));
    status.textContent = "";
  } catch {
    status.textContent = "Preferences apply to this page only.";
  }
};

theme.addEventListener("change", save);
density.addEventListener("change", save);
document.addEventListener("board-sidebar", save);
system.addEventListener("change", appearance);
appearance();
`;
}
