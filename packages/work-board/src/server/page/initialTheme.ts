export const THEME_ROUTE = "/_board/theme.js";
export const INITIAL_THEME_SCRIPT = `(() => {
  const root = document.documentElement;
  let theme = "system";
  let sidebar = "open";
  try {
    const saved = JSON.parse(localStorage.getItem("work-board:appearance:" + root.dataset.workspace) || "{}");
    if (saved.theme === "dark" || saved.theme === "light") theme = saved.theme;
    if (saved.closed === true) sidebar = "closed";
  } catch {}
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = theme;
  root.dataset.scheme = dark ? "dark" : "light";
  root.dataset.sidebar = sidebar;
  root.classList.toggle("dark", dark);
})();`;
