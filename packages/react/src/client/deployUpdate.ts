import { Effect, Schedule, Stream } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { HostVersion } from "@shivaedev/contract/HostVersion.ts";
import { pageHidden } from "./pageHidden.ts";

export function deployUpdate<E = never>(
	options: ClientOptions & {
		readonly loadedVersion: string;
		readonly activate?: Effect.Effect<void, E>;
		readonly reload: () => void;
	},
) {
	const client = makeClient(HostVersion, options);
	const version = Atom.make<string | undefined>(undefined);
	const activated = Atom.make<string | undefined>(undefined);
	const blockers = Atom.make<ReadonlySet<object>>(new Set<object>());
	const activation = client.runtime.fn((next: string, get) =>
		(options.activate ?? Effect.void).pipe(Effect.tap(() => Effect.sync(() => get.set(activated, next)))),
	);
	const connection = client.runtime.atom((get) =>
		client.api.watch.run().pipe(
			Stream.retry(Schedule.spaced("500 millis")),
			Stream.runForEach((next) => Effect.sync(() => get.set(version, next))),
		),
	);
	const state = Atom.make((get) => {
		get.mount(connection);
		get.mount(activation);
		const next = get(version);
		return {
			available: next !== undefined && next !== options.loadedVersion && next !== get(activated),
			blocked: get(blockers).size > 0,
			version: next,
		};
	});
	const controller = Atom.make((get) => {
		get.mount(state);
		get.mount(pageHidden);
		let activating: string | undefined;
		function check() {
			const current = get.once(state);
			if (
				options.activate !== undefined
				&& current.available
				&& !current.blocked
				&& get.once(pageHidden)
				&& current.version !== undefined
				&& current.version !== activating
			) {
				activating = current.version;
				get.set(activation, current.version);
			}
		}
		get.subscribe(state, check);
		get.subscribe(pageHidden, check);
		check();
		return undefined;
	}).pipe(Atom.setIdleTTL(0));
	const block = Effect.gen(function* () {
		const registry = yield* AtomRegistry.AtomRegistry;
		const key = {};
		registry.set(blockers, new Set([...registry.get(blockers), key]));
		return () => registry.set(blockers, new Set([...registry.get(blockers)].filter((entry) => entry !== key)));
	});
	return { activation, block, controller, reload: options.reload, state };
}
