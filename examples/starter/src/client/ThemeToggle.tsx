import { useEffect, useId, useState } from "react";
import { applyTheme, savedTheme, type Theme } from "./applyTheme.ts";

export function ThemeToggle() {
	const id = useId();
	const [theme, setTheme] = useState(savedTheme);
	useEffect(() => {
		applyTheme(theme);
		const preference = matchMedia("(prefers-color-scheme: dark)");
		function changed() {
			applyTheme(theme);
		}
		preference.addEventListener("change", changed);
		return () => preference.removeEventListener("change", changed);
	}, [theme]);
	function change(value: string) {
		const next: Theme = value === "light" || value === "dark" ? value : "system";
		localStorage.setItem("theme", next);
		setTheme(next);
	}
	return (
		<div className="mx-auto flex w-full max-w-2xl items-center justify-end gap-2 px-4 pt-4 text-sm sm:px-6">
			<label htmlFor={id}>Theme</label>
			<select
				className="rounded-md border bg-background px-3 py-2 text-foreground"
				id={id}
				onChange={(event) => change(event.target.value)}
				value={theme}
			>
				<option value="system">System</option>
				<option value="light">Light</option>
				<option value="dark">Dark</option>
			</select>
		</div>
	);
}
