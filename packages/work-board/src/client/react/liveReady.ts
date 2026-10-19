import { useAtomValue } from "@effect/atom-react";
import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { BrowserClient } from "#client/client.ts";

type Updates = Pick<BrowserClient["updates"], "paused" | "status">;

const always = Atom.make(true);
const waiting = Atom.make(AsyncResult.initial(true));

// The subscription's first hint reads every query again, so a read sent before that hint would be sent twice.
const ready = Atom.family((updates: Updates) =>
	Atom.make((get) => {
		const status = get(updates.status);
		return (
			get(updates.paused)
			|| Option.isSome(status.failure)
			|| status.connection === "reconnecting"
			|| (status.connection === "live" && !status.needsResync)
		);
	}),
);

export function liveReady(updates: Updates | undefined): Atom.Atom<boolean> {
	return updates === undefined ? always : ready(updates);
}

export function awaitLiveReady(registry: AtomRegistry.AtomRegistry, updates: Updates | undefined, signal: AbortSignal): Promise<void> | undefined {
	const atom = liveReady(updates);
	if (registry.get(atom)) {
		return undefined;
	}
	return Effect.runPromise(
		AtomRegistry.toStream(registry, atom).pipe(
			Stream.filter((value) => value),
			Stream.runHead,
		),
		{ signal },
	).then(() => undefined);
}

export function useLiveRead<A, E>(
	updates: Updates | undefined,
	atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
): Atom.Atom<AsyncResult.AsyncResult<A, E>> {
	return useAtomValue(liveReady(updates)) ? atom : waiting;
}
