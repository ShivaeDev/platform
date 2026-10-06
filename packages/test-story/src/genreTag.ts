export interface GenreTag {
	readonly description: string;
	readonly name: string;
}

export function genreTag(name: string): GenreTag {
	const words = name.trim().split(/\s+/u);
	return { description: `stories over a real ${words.join(" ")}`, name: `${words.join("-")}-story` };
}
