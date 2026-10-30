import { expect } from "vitest";
import { listenerConnectionStory } from "#test/listenerConnectionStory.ts";

for (const source of ["fallback", "environment", "configuration"] as const) {
	listenerConnectionStory.it(
		`a host listening through the ${source} listener connection hints a subscriber about committed note 1`,
		[],
		function* ({ hostStarts, nextHint, noteIsWritten, subscribe }) {
			expect(yield* hostStarts(source)).toBe("listening");
			yield* subscribe();

			yield* noteIsWritten();

			expect(yield* nextHint()).toBe("changed 1");
		},
	);
}

for (const [source, setting] of [
	["fallback", "DATABASE_URL"],
	["environment", "LISTEN_DATABASE_URL"],
	["configuration", "config.listenDatabaseUrl"],
] as const) {
	listenerConnectionStory.it(
		`startup fails naming ${setting} when the ${source} listener connection never delivers its heartbeat`,
		[],
		function* ({ heartbeatDeadlinePasses, hostStartsWithMutedListener, startupOutcome }) {
			yield* hostStartsWithMutedListener(source);

			yield* heartbeatDeadlinePasses();

			expect(yield* startupOutcome()).toEqual({
				failure: "listener unavailable",
				message: expect.stringContaining(`Set ${setting} to a direct or session-mode connection`),
				setting,
			});
		},
	);
}
