import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { AppId, preflight } from "#test/app-host/preflight.ts";
import { environment, host, postgresHost, startupFails } from "#test/app-host/story.ts";

const hosts: readonly [Pick<typeof host, "it">, Parameters<typeof preflight>[0]][] = [
	[host, "http"],
	[postgresHost, "migrate"],
	[postgresHost, "check"],
	[postgresHost, "wait"],
];

for (const [kit, mode] of hosts) {
	for (const deferred of mode === "http" ? [false] : [false, true]) {
		const label = `a ${mode} host${deferred ? " with deferred construction" : ""}`;
		const started = [
			"preflight",
			...(mode === "http" ? [] : ["loading"]),
			...(mode === "migrate" ? ["migrated"] : []),
			...(deferred ? ["constructing"] : []),
			"started",
		];

		kit.it(
			`an empty APP_ID fails ${label} at preflight before migrations or application startup`,
			[preflight(mode, deferred), environment({ "APP_ID": "" }), startupFails],
			function* ({ serviceLifecycle, startup }) {
				yield* outcomes([
					["construction steps", () => serviceLifecycle(), ["preflight"]],
					["startup", () => startup(), "failed with preflight failure"],
				]);
			},
		);

		kit.it(
			`${label} records ${started.join(", ")} in that order during startup`,
			[preflight(mode, deferred), environment({ "APP_ID": "valid-app" })],
			function* ({ serviceLifecycle }) {
				expect(yield* serviceLifecycle()).toEqual(started);
			},
		);

		kit.it(
			`${label} shares the preflight's app ID with the host and its handlers`,
			[preflight(mode, deferred), environment({ "APP_ID": "valid-app" })],
			function* ({ ping, provided }) {
				yield* outcomes([
					["app ID in a handler", () => ping(), "valid-app"],
					["app ID in the host", () => provided(AppId), "provided"],
				]);
			},
		);

		kit.it(
			`closing ${label} releases the preflight's services`,
			[preflight(mode, deferred), environment({ "APP_ID": "valid-app" })],
			function* ({ close, serviceLifecycle }) {
				expect(yield* serviceLifecycle()).toEqual(started);

				yield* close();

				expect(yield* serviceLifecycle()).toEqual([...started, "released"]);
			},
		);
	}
}
