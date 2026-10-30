import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { deferred } from "#test/app-host/deferred.ts";
import { host, startupFails } from "#test/app-host/story.ts";

for (const mode of ["migrate", "check"] as const) {
	host.it(`migration mode ${mode} finishes before the deferred application is constructed`, [deferred(mode)], function* ({ ping, serviceLifecycle }) {
		yield* outcomes({
			"construction steps": [serviceLifecycle(), ["migrated", "constructing", "constructed"]],
			"native RPC": [ping(), "pong"],
		});
	});

	host.it(
		`closing a host in migration mode ${mode} releases the deferred application's scope`,
		[deferred(mode)],
		function* ({ close, serviceLifecycle }) {
			expect(yield* serviceLifecycle()).toEqual(["migrated", "constructing", "constructed"]);

			yield* close();

			expect(yield* serviceLifecycle()).toEqual(["migrated", "constructing", "constructed", "released"]);
		},
	);

	host.it(
		`a failed migration in mode ${mode} fails startup before the deferred application is constructed`,
		[deferred(mode, true), startupFails],
		function* ({ serviceLifecycle, startup }) {
			yield* outcomes({
				"construction steps": [serviceLifecycle(), []],
				"startup": [startup(), "failed with migration error"],
			});
		},
	);
}
