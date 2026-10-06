import type { GenreTag } from "#genreTags.ts";

export interface Genre {
	readonly tag: GenreTag;
	readonly title: string;
}

export function genreOf(kitName: string): Genre {
	const words = kitName.trim().split(/\s+/u);
	return {
		tag: { description: `stories over a real ${words.join(" ")}`, name: [...words.map((word) => word.toLowerCase()), "story"].join("-") },
		title: [...words, "story"].map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(" "),
	};
}
