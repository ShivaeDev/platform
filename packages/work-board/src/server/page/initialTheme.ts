export const THEME_ROUTE = "/_board/theme.js";
export const INITIAL_THEME_SCRIPT = `(() => {
  const root = document.documentElement;
  let theme = "system";
  try {
    const saved = JSON.parse(localStorage.getItem("work-board:appearance:" + root.dataset.workspace) || "{}");
    if (saved.theme === "dark" || saved.theme === "light") theme = saved.theme;
  } catch {}
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = theme;
  root.dataset.scheme = dark ? "dark" : "light";
  root.classList.toggle("dark", dark);
})();`;
