import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { invalidTrust } from "#test/app-host/options.ts";
import { configuration, environment, host, sessionPolicy, startupFails } from "#test/app-host/story.ts";

for (const [source, bind] of [
	["HOST", environment({ "HOST": "0.0.0.0" })],
	["config.host", configuration({ host: "0.0.0.0" })],
] as const) {
	host.it(
		`a session host bound to 0.0.0.0 by ${source} without proxy trust fails startup naming both trust settings`,
		[invalidTrust, startupFails, bind],
		function* ({ startup, startupFailureMessage }) {
			yield* outcomes({
				"message": [startupFailureMessage(), expect.stringMatching(/Set TRUSTED_PROXY.*peer IP addresses or CIDR ranges.*config\.trustedProxy/u)],
				"startup": [startup(), "failed with trusted proxy required"],
			});
		},
	);
}

for (const [name, traits] of [
	["a session host on the default loopback address", [sessionPolicy]],
	["the loopback policy bound to 0.0.0.0", [configuration({ host: "0.0.0.0" })]],
	["a session host on 0.0.0.0 with TRUSTED_PROXY", [sessionPolicy, environment({ "HOST": "0.0.0.0", "TRUSTED_PROXY": "127.0.0.1" })]],
	["a session host on 0.0.0.0 with config.trustedProxy", [sessionPolicy, configuration({ host: "0.0.0.0", trustedProxy: "127.0.0.1" })]],
	[
		"a session host whose config.host loopback overrides HOST 0.0.0.0",
		[sessionPolicy, configuration({ host: "127.0.0.1" }), environment({ "HOST": "0.0.0.0" })],
	],
] as const) {
	host.it(`${name} starts and serves local RPC`, traits, function* ({ ping }) {
		expect(yield* ping()).toBe("pong");
	});
}
