import { Cause, type Duration, Option, Predicate } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { type LiveBound, LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { recheckUnauthorized } from "#internal/sessionRecheck.ts";

function isLiveBound(value: unknown): value is LiveBound {
	return Predicate.hasProperty(value, LiveConnection);
}

function recheckFailure(registry: AtomRegistry.AtomRegistry, failure: Option.Option<Cause.Cause<unknown>>) {
	const error = Option.flatMap(failure, Cause.findErrorOption);
	if (Option.isSome(error)) {
		void recheckUnauthorized(registry, error.value, true);
	}
}

export function mountLive(registry: AtomRegistry.AtomRegistry, client: unknown, coalesceWindow?: Duration.Input) {
	const releases: Array<() => void> = [];
	const found = new Set<unknown>();
	function mount(value: unknown) {
		if (!isLiveBound(value)) {
			return;
		}
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
	mount(client);
	if (typeof client === "object" && client !== null) {
		for (const value of Object.values(client)) {
			mount(value);
		}
	}
	return () => {
		for (const release of releases) {
			release();
		}
	};
}
