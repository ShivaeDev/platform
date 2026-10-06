import { genreOf } from "#internal/genre.ts";

export interface GenreTag {
	readonly description: string;
	readonly name: string;
}

export function genreTags(...kitNames: readonly string[]): GenreTag[] {
	return kitNames.map((kitName) => genreOf(kitName).tag);
}
