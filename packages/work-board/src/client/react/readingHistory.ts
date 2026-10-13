import { Option, Schema } from "effect";
import { ReadingState } from "./readingState.ts";

const Entries = Schema.Record(Schema.String, ReadingState);
const Entry = Schema.Struct({ id: Schema.String, reading: Schema.optional(Schema.NullOr(ReadingState)) });
export function readingEntry(value: unknown) {
	return Option.getOrUndefined(Schema.decodeUnknownOption(Entry)(value));
}
export function readingHistory() {
	const key = `work-board:reading:${document.documentElement.dataset.workspace}`;
	let entries: Record<string, ReadingState>;
	try {
		entries = Option.getOrElse(Schema.decodeUnknownOption(Entries)(JSON.parse(sessionStorage.getItem(key) ?? "{}")), () => ({}));
	} catch {
		entries = {};
	}
	return {
		get: (id: string) => entries[id],
		save: (id: string, reading: ReadingState) => {
			delete entries[id];
			entries[id] = reading;
			entries = Object.fromEntries(Object.entries(entries).slice(-30));
			try {
				sessionStorage.setItem(key, JSON.stringify(entries));
				return true;
			} catch {
				return false;
			}
		},
	};
}
