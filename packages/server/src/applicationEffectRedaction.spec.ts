import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { badgeListedInConfig, builtInApplicationEffect, loggingApplicationEffect } from "#test/defined-modules/applicationForm.ts";
import { definedModulesHost } from "#test/defined-modules/story.ts";

definedModulesHost.it(
	"a password, a model-marked address and a config-listed badge are masked in a log the application Effect writes, in a log from a fiber it forked and in a log through a context it captured, as in a served operation's log",
	[builtInApplicationEffect, loggingApplicationEffect, badgeListedInConfig],
	function* ({ capturedContextLog, constructionLog, forkedFiberLog, joinMember, loggedMember, showMember }) {
		yield* joinMember("alice", "1 Elm Street");
		yield* showMember(1);

		yield* outcomes([
			["application Effect's log", () => constructionLog(), { address: "<redacted>", badge: "<redacted>", password: "<redacted>" }],
			["forked fiber's log", () => forkedFiberLog(), { address: "<redacted>", badge: "<redacted>", password: "<redacted>" }],
			["captured context's log", () => capturedContextLog(), { address: "<redacted>", badge: "<redacted>", password: "<redacted>" }],
			["served operation's log", () => loggedMember(), { address: "<redacted>", id: 1, name: "alice", passcode: "<redacted>" }],
		]);
	},
);
