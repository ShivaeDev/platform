import { Cause, type Duration, Option, Predicate } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { liveBindings } from "#internal/liveBindings.ts";
import { recheckUnauthorized } from "#internal/sessionRecheck.ts";

function recheckFailure(registry: AtomRegistry.AtomRegistry, failure: Option.Option<Cause.Cause<unknown>>) {
	const error = Option.flatMap(failure, Cause.findErrorOption);
	if (Option.isSome(error)) {
		void recheckUnauthorized(registry, error.value, true);
	}
}

export function mountLive(registry: AtomRegistry.AtomRegistry, client: unknown, coalesceWindow?: Duration.Input) {
	const releases: Array<() => void> = [];
	const found = new Set<unknown>();
	for (const value of liveBindings(client)) {
		const live = value[LiveConnection];
		if (Predicate.hasProperty(live, "connection") && Atom.isAtom(live.connection) && !found.has(live.connection)) {
			if (
				coalesceWindow !== undefined
				&& Predicate.hasProperty(live, "coalesceWindow")
				&& Atom.isAtom(live.coalesceWindow)
				&& Atom.isWritable(live.coalesceWindow)
			) {
				registry.set(live.coalesceWindow, coalesceWindow);
			}
			found.add(live.connection);
			releases.push(
				registry.subscribe(
					Atom.map(live.status, (status) => status.failure),
					(failure) => recheckFailure(registry, failure),
					{ immediate: true },
				),
			);
			releases.push(registry.mount(live.connection));
		}
	}
	return () => {
		for (const release of releases) {
			release();
		}
	};
}
