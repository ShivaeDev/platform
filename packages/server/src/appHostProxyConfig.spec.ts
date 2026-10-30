import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
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
	for (const [source, trust] of [
		["config.trustedProxy", configuration({ trustedProxy: value })],
		["TRUSTED_PROXY", environment({ "TRUSTED_PROXY": value })],
	] as const) {
		host.it(
			`${source} ${JSON.stringify(value)} fails startup with a config error before migrations, routes or services run`,
			[invalidTrust, startupFails, trust],
			function* ({ serviceLifecycle, startup }) {
				yield* outcomes({
					"construction steps": [serviceLifecycle(), []],
					"startup": [startup(), "failed with config error"],
				});
			},
		);
	}
}
