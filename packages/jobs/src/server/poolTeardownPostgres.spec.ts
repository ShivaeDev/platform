import { expect } from "vitest";
import { poolTeardown } from "#test/poolTeardown.ts";
import { makePgBossTesting } from "#testing.ts";

for (const testing of [false, true]) {
	poolTeardown.it(
		`the ${testing ? "testing" : "default"} client scope waits for its PostgreSQL transports to disconnect`,
		[],
		function* ({ open, backends, close, nativeStopped, shutdownResult, releaseDisconnects, waitForShutdown }) {
			yield* open(testing ? makePgBossTesting().clientFactory : undefined);
			expect((yield* backends()).length).toBeGreaterThan(0);
			const shutdown = yield* close();
			yield* nativeStopped();
			expect(yield* backends()).toEqual([]);
			expect(yield* shutdownResult(shutdown)).toBeUndefined();
			yield* releaseDisconnects();
			yield* waitForShutdown(shutdown);
			expect(yield* backends()).toEqual([]);
		},
	);
}
