import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { builtInApplicationEffect, collector } from "#test/defined-modules/applicationForm.ts";
import { definedModulesHost } from "#test/defined-modules/story.ts";

definedModulesHost.it(
	"an operation served by a host whose application Effect builds the repositories reads their owned models, with their tables and owner columns, and not the unowned one",
	[builtInApplicationEffect],
	function* ({ ownedModels }) {
		expect(yield* ownedModels()).toEqual([
			{ column: "ownerId", table: "notebooks" },
			{ column: "userId", table: "reminders" },
		]);
	},
);

definedModulesHost.it(
	"a host whose application Effect builds the repositories masks the fields their model marks sensitive or server-only in an operation's log, its logged defect and its exported span",
	[builtInApplicationEffect, collector],
	function* ({ auditMember, exportedMemberSpan, joinMember, loggedDefect, loggedMember, showMember }) {
		yield* joinMember("alice", "1 Elm Street");

		yield* outcomes([
			["shown member", () => showMember(1), { address: "1 Elm Street", id: 1, name: "alice" }],
			["logged member", () => loggedMember(), { address: "<redacted>", id: 1, name: "alice", passcode: "<redacted>" }],
			["exported span", () => exportedMemberSpan(), { address: "<redacted>", id: 1, name: "alice" }],
			["audit answer", () => auditMember(1), "failed with internal server error"],
			["logged audit defect", () => loggedDefect(), { member: { address: "<redacted>", id: 1, name: "alice" } }],
		]);
	},
);
