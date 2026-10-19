import { Option, Schema } from "effect";
import { createContext } from "react";

const Item = Schema.Struct({ at: Schema.optional(Schema.Number), file: Schema.NonEmptyString, title: Schema.String });
export type Item = typeof Item.Type;
const Saved = Schema.Struct({ favorites: Schema.optional(Schema.Unknown), recents: Schema.optional(Schema.Unknown) });
function valid(value: unknown): Item[] {
	return Array.isArray(value) ? value.flatMap((entry) => Option.toArray(Schema.decodeUnknownOption(Item)(entry))) : [];
}
export function restoreLibrary(key: string) {
	try {
		const saved = Option.getOrUndefined(Schema.decodeUnknownOption(Saved)(JSON.parse(localStorage.getItem(key) ?? "{}")));
		return { favorites: valid(saved?.favorites), notice: "", recents: valid(saved?.recents) };
	} catch {
		return { favorites: [], notice: "Reading history applies to this page only.", recents: [] };
	}
}
interface LibraryState {
	readonly favorites: readonly Item[];
	readonly openHistory: (returnFocus: HTMLElement | null) => void;
	readonly recents: readonly Item[];
	readonly toggle: (file: string, title: string) => void;
}
export const LibraryContext = createContext<LibraryState>({ favorites: [], openHistory: () => undefined, recents: [], toggle: () => undefined });
export function otherRecents(library: Pick<LibraryState, "favorites" | "recents">, current: string): readonly Item[] {
	const pinned = new Set(library.favorites.map((item) => item.file));
	return library.recents.filter((item) => item.file !== current && !pinned.has(item.file));
}
