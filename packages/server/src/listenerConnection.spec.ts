import { expect } from "vitest";
import { listenerConnectionStory } from "#test/listenerConnectionStory.ts";

for (const source of ["fallback", "environment", "configuration"] as const) {
	listenerConnectionStory.it(
		`the ${source} listener connection delivers committed changes`,
		[],
		function* ({ boot, nextHint, startupOutcome, subscribe, write }) {
			yield* boot(source, false);
			expect(yield* startupOutcome()).toBe("listening");
			yield* subscribe();
			expect(yield* nextHint()).toEqual({ _tag: "Resync" });

			yield* write();

			expect(yield* nextHint()).toEqual({ _tag: "Changed", keys: [{ _tag: "Item", collection: "notes", id: 1 }] });
		},
	);
}

for (const [source, setting] of [
	["fallback", "DATABASE_URL"],
	["environment", "LISTEN_DATABASE_URL"],
	["configuration", "config.listenDatabaseUrl"],
] as const) {
	listenerConnectionStory.it(
		`startup fails naming ${setting} when PostgreSQL cannot deliver the listener heartbeat`,
		[],
		function* ({ boot, heartbeatDeadlinePasses, mutedHeartbeat, startupOutcome }) {
			yield* boot(source, true);
			yield* mutedHeartbeat();

			yield* heartbeatDeadlinePasses();

			expect(yield* startupOutcome()).toEqual({
				failure: "listener unavailable",
				message: expect.stringContaining(`Set ${setting} to a direct or session-mode connection`),
				setting,
			});
		},
	);
}
