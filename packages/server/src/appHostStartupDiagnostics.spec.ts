import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { preflight } from "#test/app-host/preflight.ts";
import { configuration, environment, host, startupFails } from "#test/app-host/story.ts";

for (const mode of ["http", "migrate", "check", "wait"] as const) {
	for (const deferred of mode === "http" ? [false] : [false, true]) {
		const label = `a ${mode} host${deferred ? " with deferred construction" : ""}`;

		host.it(
			`${label} redacts a preflight failure's log while preserving its typed tag and message`,
			[preflight(mode, deferred, "failure"), startupFails],
			function* ({ diagnosticLog, logMentions, startup, startupFailureMessage }) {
				yield* outcomes([
					["logged annotations", () => diagnosticLog("Preflight failed"), { password: "<redacted>" }],
					[
						"logged failure",
						() => logMentions("Preflight failed", "PreflightFailure", "<redacted>"),
						["Preflight failed", "PreflightFailure", "<redacted>"],
					],
					["logged secrets", () => logMentions("hidden-"), []],
					["typed startup failure", () => startup(), "failed with preflight failure"],
					["original failure message", () => startupFailureMessage(), "Cannot connect to postgres://app:hidden-startup-password@localhost/db"],
				]);
			},
		);

		host.it(
			`${label} preserves an ordinary preflight log and still logs its listening address`,
			[preflight(mode, deferred, "success"), environment({ "APP_ID": "valid-app" })],
			function* ({ diagnosticLog, logMentions, startup }) {
				yield* outcomes([
					["ordinary log annotations", () => diagnosticLog("Preflight ready"), { app: "board" }],
					["startup messages", () => logMentions("Preflight ready", "Listening on"), ["Preflight ready", "Listening on"]],
					["startup", () => startup(), "listening"],
				]);
			},
		);
	}
}

host.it(
	"a direct host redacts configured sensitive fields in preflight logs",
	[preflight("http", false, "failure"), configuration({ sensitiveKeys: ["workspace"] }), startupFails],
	function* ({ diagnosticLog, logMentions }) {
		yield* outcomes([
			["configured field", () => diagnosticLog("Preflight failed"), { workspace: "<redacted>" }],
			["configured secret", () => logMentions("private-workspace"), []],
		]);
	},
);
