export type Theme = "system" | "light" | "dark";

export function savedTheme(): Theme {
	const saved = localStorage.getItem("theme");
	return saved === "light" || saved === "dark" ? saved : "system";
}

export function applyTheme(theme: Theme) {
	const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
	document.documentElement.classList.toggle("dark", dark);
	document.documentElement.classList.toggle("light", !dark);
}
