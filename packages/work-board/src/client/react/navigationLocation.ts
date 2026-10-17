import { readingEntry } from "#client/react/storedReadings.ts";

export function navigationFailure(status: number) {
	const code = status;
	if (code < 400) {
		return "";
	}
	return code === 404 ? "This document is missing or was renamed." : "Could not open this document. Retry the link or reload the page.";
}
export function currentEntry(state: object, displayed: string, initial: ReturnType<typeof readingEntry>) {
	const current = readingEntry(Reflect.get(state, "workBoard"));
	return current ?? (displayed === "" ? initial : undefined);
}

export function readingKey(key: string, entry: { readonly id: string } | undefined, aliases: Map<string, string>) {
	if (entry) {
		aliases.set(key, entry.id);
	}
	return aliases.get(key) ?? key;
}

export function sameReadingLocation(
	previous: { readonly route: string; readonly id: string; readonly hash: string },
	next: { readonly route: string; readonly id: string; readonly hash: string },
) {
	return previous.route === next.route && previous.id === next.id && previous.hash === next.hash;
}
