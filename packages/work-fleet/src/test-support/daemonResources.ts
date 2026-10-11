import { vi } from "@effect/vitest";
import { Effect, Layer } from "effect";
import pg from "pg";
import { SessionTransport } from "#session/service.ts";

export const daemonResources = Effect.fn("DaemonTest.daemonResources")(function* (source: Layer.Layer<SessionTransport, unknown>) {
	const closed = vi.spyOn(pg.Pool.prototype, "end");
	const queries = vi.spyOn(pg.Pool.prototype, "query");
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			queries.mockRestore();
			closed.mockRestore();
		}),
	);
	let providers = 0;
	let releases = 0;
	const provider = Layer.effect(SessionTransport)(
		Effect.gen(function* () {
			providers += 1;
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					releases += 1;
				}),
			);
			return yield* SessionTransport;
		}).pipe(Effect.provide(source)),
	);
	return {
		closed,
		pools: () => Array.from(new Set(queries.mock.contexts.filter((value): value is pg.Pool => value instanceof pg.Pool))),
		provider,
		get providers() {
			return providers;
		},
		get releases() {
			return releases;
		},
	};
});
