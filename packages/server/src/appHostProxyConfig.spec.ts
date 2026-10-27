import { Cause, Config } from "effect";
import { expect } from "vitest";
import { invalidTrust } from "#test/app-host/options.ts";
import { configuration, environment, host, startupFails } from "#test/app-host/story.ts";

for (const value of [
	"10.0.0.0/33",
	"2001:db8::/129",
	"10.0.0.0/-1",
	"10.0.0.0/1.5",
	"10.0.0.0/",
	"10.0.0.0/24/1",
	"10.0.0.0/nope",
	"10.0.0.999/24",
	"2001:db8::gg/64",
	"10.0.0.1,",
	"10.0.0.1,,::1",
	"",
	" ",
	"*",
	"proxy.example",
]) {
	for (const source of ["config", "environment"]) {
		host.it(
			`rejects malformed trust at startup from ${source}: ${value}`,
			[invalidTrust, startupFails, source === "config" ? configuration({ trustedProxy: value }) : environment({ "TRUSTED_PROXY": value })],
			({ bootFailure, lifecycle }) => {
				expect(Cause.squash(bootFailure())).toBeInstanceOf(Config.ConfigError);
				expect(lifecycle()).toEqual([]);
			},
		);
	}
}
