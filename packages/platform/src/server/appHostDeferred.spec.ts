import { expect } from "vitest";
import { deferred } from "#test/app-host/deferred.ts";
import { host, startupFails } from "#test/app-host/story.ts";

for (const mode of ["migrate", "check"] as const) {
	host.it(`${mode} completes before application construction and owns its scope`, [deferred(mode)], function* ({ ping, lifecycle, close }) {
		expect(yield* ping()).toBe("pong");
		expect(lifecycle()).toEqual(["migrated", "constructing", "constructed"]);
		yield* close();
		expect(lifecycle()).toEqual(["migrated", "constructing", "constructed", "released"]);
	});
	host.it(`failed ${mode} prevents application construction`, [deferred(mode, true), startupFails], ({ lifecycle, bootFailure }) => {
		expect(bootFailure()).toBeDefined();
		expect(lifecycle()).toEqual([]);
	});
}
