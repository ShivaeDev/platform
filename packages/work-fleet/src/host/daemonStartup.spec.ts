import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { daemonStartup } from "#test/daemonStartup.ts";

daemonStartup.it("a replacement daemon accepts reconnects only after its handlers are ready", [], function* (daemon) {
	expect(yield* daemon.acceptsConnections()).toBe(false);
	yield* daemon.resume();
	yield* outcomes([
		["accepts connections", () => daemon.acceptsConnections(), true],
		["snapshot", () => daemon.snapshot(), [[]]],
	]);
});
