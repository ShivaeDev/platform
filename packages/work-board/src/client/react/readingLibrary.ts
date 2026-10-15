import { Option, Schema } from "effect";
import { createContext } from "react";

const Item = Schema.Struct({ file: Schema.NonEmptyString, title: Schema.String });
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
	readonly recents: readonly Item[];
	readonly toggle: (file: string, title: string) => void;
}
export const LibraryContext = createContext<LibraryState>({ favorites: [], recents: [], toggle: () => undefined });
