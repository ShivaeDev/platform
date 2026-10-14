import { Option, Schema } from "effect";
import { useEffect, useRef, useState } from "react";
import { useMedia } from "./useMedia.ts";

const Appearance = Schema.Struct({
	closed: Schema.optional(Schema.Unknown),
	density: Schema.optional(Schema.Unknown),
	theme: Schema.optional(Schema.Unknown),
});
function restore(key: string) {
	try {
		const saved = Option.getOrUndefined(Schema.decodeUnknownOption(Appearance)(JSON.parse(localStorage.getItem(key) ?? "{}")));
		return {
			closed: saved?.closed === true,
			density: saved?.density === "compact" ? "compact" : "comfortable",
			notice: "",
			theme: saved?.theme === "light" || saved?.theme === "dark" ? saved.theme : "system",
		};
	} catch {
		return { closed: false, density: "comfortable", notice: "Preferences apply to this page only.", theme: "system" };
	}
}
export function useAppearance() {
	const key = `work-board:appearance:${document.documentElement.dataset.workspace}`;
	const [value, setValue] = useState(() => restore(key));
	const valueRef = useRef(value);
	const dark = useMedia("(prefers-color-scheme: dark)");
	const systemScheme = dark ? "dark" : "light";
	const scheme = value.theme === "system" ? systemScheme : value.theme;
	useEffect(() => {
		const root = document.documentElement;
		root.dataset.theme = value.theme;
		root.dataset.density = value.density;
		root.dataset.scheme = scheme;
		root.classList.toggle("dark", scheme === "dark");
		const doc = document.getElementById("doc");
		if (doc) {
			doc.dataset.scheme = scheme;
		}
		document.dispatchEvent(new Event("board-theme"));
	}, [value.theme, value.density, scheme]);
	function change(next: Partial<Pick<typeof value, "closed" | "density" | "theme">>) {
		const appearance = { closed: valueRef.current.closed, density: valueRef.current.density, theme: valueRef.current.theme, ...next };
		let notice = "";
		try {
			localStorage.setItem(key, JSON.stringify(appearance));
		} catch {
			notice = "Preferences apply to this page only.";
		}
		valueRef.current = { ...appearance, notice };
		setValue(valueRef.current);
	}
	return { ...value, change };
}
export type AppearanceControls = ReturnType<typeof useAppearance>;
