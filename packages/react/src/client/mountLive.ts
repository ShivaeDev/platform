import { Cause, Effect, Option, Predicate } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { liveBindings } from "@shivaedev/contract/composeBindings.ts";
import { recheckUnauthorized } from "#sessionRecheck.ts";

export const mountLive = Effect.fn("Live.mountLive")(function* (client: unknown) {
	const registry = yield* AtomRegistry.AtomRegistry;
	function recheckFailure(failure: Option.Option<Cause.Cause<unknown>>) {
		const error = Option.flatMap(failure, Cause.findErrorOption);
		if (Option.isSome(error)) {
			void recheckUnauthorized(registry, error.value);
		}
	}

	const releases: Array<() => void> = [];
	const found = new Set<unknown>();
	for (const value of liveBindings(client)) {
		const live = value[LiveConnection];
		if (Predicate.hasProperty(live, "connection") && Atom.isAtom(live.connection) && !found.has(live.connection)) {
			found.add(live.connection);
			releases.push(
				registry.subscribe(
					Atom.map(live.status, (status) => status.failure),
					(failure) => recheckFailure(failure),
					{ immediate: true },
				),
			);
			releases.push(registry.mount(live.connection));
		}
	}
	return (): void => {
		for (const release of releases) {
			release();
		}
	};
});
