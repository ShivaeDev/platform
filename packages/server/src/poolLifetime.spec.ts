import { expect } from "vitest";
import { poolLifetime, separateListener, shortIdle, shortLifetime, staysIdle, staysOpenUntilLifetime } from "#test/poolLifetime.ts";

for (const [name, lifetime] of [
	["default ten-minute", []],
	["configured thirty-second", [shortLifetime]],
] as const) {
	poolLifetime.it(
		`the query backend disconnects and is replaced after its ${name} lifetime`,
		[staysOpenUntilLifetime, ...lifetime],
		function* ({ backend, backendIsConnected, lifetimePasses, untilBackendCloses }) {
			const before = yield* backend();
			expect(before).toEqual(expect.any(Number));

			yield* lifetimePasses();

			expect(yield* backend()).not.toBe(before);
			yield* untilBackendCloses(before);
			expect(yield* backendIsConnected(before)).toBe(false);
		},
	);
}

for (const [name, idle] of [
	["default one-minute", []],
	["configured thirty-second", [shortIdle]],
] as const) {
	poolLifetime.it(
		`an idle query backend closes at its ${name} idle timeout`,
		[staysIdle, ...idle],
		function* ({ backend, backendIsConnected, idleTimeoutPasses, untilBackendCloses }) {
			const before = yield* backend();
			expect(yield* backendIsConnected(before)).toBe(true);

			yield* idleTimeoutPasses();

			yield* untilBackendCloses(before);
			expect(yield* backendIsConnected(before)).toBe(false);
		},
	);
}

for (const [name, listener] of [
	["shared", []],
	["separate", [separateListener]],
] as const) {
	poolLifetime.it(
		`a ${name} LISTEN backend renews, resyncs subscribers and delivers subsequent committed hints`,
		listener,
		function* ({ lifetimePasses, listenerBackend, listenerRenews, nextHint, noteIsWritten, subscribe }) {
			yield* subscribe();
			const before = yield* listenerBackend();
			expect(before).toEqual(expect.any(Number));
			yield* noteIsWritten(1);
			expect(yield* nextHint()).toBe("changed 1");

			yield* lifetimePasses();

			expect(yield* nextHint()).toBe("resync");
			yield* listenerRenews(before);
			expect(yield* nextHint()).toBe("resync");
			expect(yield* listenerBackend()).not.toBe(before);
			yield* noteIsWritten(2);
			expect(yield* nextHint()).toBe("changed 2");
		},
	);
}
