import { expect } from "vitest";
import { TrustedProxyRequired } from "#TrustedProxyRequired.ts";
import { invalidTrust } from "#test/app-host/options.ts";
import { configuration, environment, host, sessionPolicy, startupFails } from "#test/app-host/story.ts";

for (const source of ["environment", "config"]) {
	host.it(
		`refuses to boot a non-loopback session host without proxy trust (${source})`,
		[invalidTrust, startupFails, source === "config" ? configuration({ host: "0.0.0.0" }) : environment({ "HOST": "0.0.0.0" })],
		({ startupFailure }) => {
			expect(startupFailure()).toEqual(
				expect.objectContaining({
					constructor: TrustedProxyRequired,
					message: expect.stringMatching(/Set TRUSTED_PROXY.*peer IP addresses or CIDR ranges.*config\.trustedProxy/u),
				}),
			);
		},
	);
}

for (const [name, traits] of [
	["default loopback", [sessionPolicy]],
	["loopback policy", [configuration({ host: "0.0.0.0" })]],
	["environment proxy", [sessionPolicy, environment({ "HOST": "0.0.0.0", "TRUSTED_PROXY": "127.0.0.1" })]],
	["configured proxy", [sessionPolicy, configuration({ host: "0.0.0.0", trustedProxy: "127.0.0.1" })]],
	["configured host overrides HOST", [sessionPolicy, configuration({ host: "127.0.0.1" }), environment({ "HOST": "0.0.0.0" })]],
] as const) {
	host.it(`serves local RPC with ${name}`, traits, function* ({ ping }) {
		const response = yield* ping();

		expect(response).toBe("pong");
	});
}
