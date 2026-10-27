import type { AnyRouter } from "@tanstack/react-router";
import * as HttpStatus from "effect/http/HttpStatus";
import { readingEntry } from "#client/react/storedReadings.ts";

export const REFRESH_FAILURE = "Couldn't refresh this page";

// A page without a document already explains its failure in the body, so only a retained document needs the header to say it is out of date.
export function navigationFailure({ file, status }: { readonly file: string; readonly status: number }) {
	if (status < HttpStatus.fromLiteral("BadRequest")) {
		return undefined;
	}
	return file === "" ? "" : REFRESH_FAILURE;
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

export function recordEntry(router: AnyRouter, route: string, id: string, native: boolean) {
	if (!native) {
		return;
	}
	router.history.flush?.();
	if (window.location.pathname + window.location.search !== route || window.history.state?.workBoard?.id === id) {
		return;
	}
	window.history.replaceState({ ...window.history.state, workBoard: { id } }, "");
}
