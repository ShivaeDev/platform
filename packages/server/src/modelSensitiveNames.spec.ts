import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { definedModulesHost, privateJoinPayload } from "#test/defined-modules/story.ts";

definedModulesHost.it(
	"a module operation's row reaches alice whole and its defect reaches her as an internal server error, while the row in its log and in its logged defect masks the field the stored model marks sensitive",
	[],
	function* ({ auditMember, joinMember, loggedDefect, loggedMember, showMember }) {
		yield* joinMember("alice", "1 Elm Street");

		yield* outcomes([
			["shown member", () => showMember(1), { address: "1 Elm Street", id: 1, name: "alice" }],
			["logged member", () => loggedMember(), { address: "<redacted>", id: 1, name: "alice" }],
			["audit answer", () => auditMember(1), "failed with internal server error"],
			["logged audit defect", () => loggedDefect(), { member: { address: "<redacted>", id: 1, name: "alice" } }],
		]);
	},
);

definedModulesHost.it(
	"a module whose join payload marks address sensitive while its generated success names address starts and serves the join",
	[privateJoinPayload],
	function* ({ joinMember, startup }) {
		yield* outcomes([
			["host startup", () => startup(), "started"],
			["alice's join", () => joinMember("alice", "1 Elm Street"), { address: "1 Elm Street", id: 1, name: "alice" }],
		]);
	},
);
