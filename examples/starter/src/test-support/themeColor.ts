export function themeColor(css: string, theme: "light" | "dark", name: string) {
	if (name.startsWith("#")) {
		return name;
	}
	const value = css.match(new RegExp(`--${name}:\\s*light-dark\\((#[a-f0-9]{6}),\\s*(#[a-f0-9]{6})\\)`, "iu"));
	const selected = value?.[theme === "light" ? 1 : 2];
	if (selected === undefined) {
		throw new Error(`Missing ${theme} token ${name}`);
	}
	return selected;
}

export function withThemeColor(css: string, theme: "light" | "dark", name: string, color: string) {
	const light = theme === "light" ? color : themeColor(css, "light", name);
	const dark = theme === "dark" ? color : themeColor(css, "dark", name);
	return css.replace(new RegExp(`--${name}:\\s*light-dark\\([^)]*\\)`, "u"), `--${name}: light-dark(${light}, ${dark})`);
}
