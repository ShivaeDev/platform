import { expect } from "@effect/vitest";
import { daemonStartup } from "#test/daemonStartup.ts";

daemonStartup.it("a replacement daemon accepts reconnects only after its handlers are ready", [], function* (daemon) {
	expect(yield* daemon.acceptsConnections()).toBe(false);
	yield* daemon.resume();
	expect(yield* daemon.acceptsConnections()).toBe(true);
	expect(yield* daemon.snapshot()).toEqual([[]]);
});
