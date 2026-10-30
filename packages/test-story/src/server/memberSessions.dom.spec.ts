import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { sharedLists, signedInMembers } from "#test/sharedListScreen.ts";

sharedLists.it("shows grace the item ada adds once grace refreshes", [signedInMembers("ada", "grace")], function* ({ addsItem, refreshes, list }) {
	yield* addsItem("ada", "Bread");
	expect(yield* list("grace")).toBe("grace's list: ");

	yield* refreshes("grace");

	expect(yield* list("grace")).toBe("grace's list: ada: Bread");
});

sharedLists.it("keeps ada's draft out of grace's atom registry", [signedInMembers("ada", "grace")], function* ({ typesDraft, draft }) {
	yield* typesDraft("ada", "Bread");

	yield* outcomes({ "ada's draft": [draft("ada"), "Bread"], "grace's draft": [draft("grace"), ""] });
});

sharedLists.it("signs out only ada's cookie session", [signedInMembers("ada", "grace")], function* ({ signsOut, refreshes, list }) {
	yield* outcomes({ "ada's list": [list("ada"), "ada's list: "], "grace's list": [list("grace"), "grace's list: "] });

	yield* signsOut("ada");
	yield* refreshes("grace");

	yield* outcomes({ "ada's list": [list("ada"), "Signed out"], "grace's list": [list("grace"), "grace's list: "] });
});

sharedLists.it(
	"closing the members' Scope removes every root and disposes every atom registry",
	[signedInMembers("ada", "grace")],
	function* ({ attachedRoots, closesMembers, draft }) {
		yield* outcomes({
			"ada's draft": [draft("ada"), ""],
			"grace's draft": [draft("grace"), ""],
			"the attached roots": [attachedRoots(), ["ada", "grace"]],
		});

		yield* closesMembers();

		yield* outcomes({
			"ada's draft": [draft("ada"), "its registry is disposed"],
			"grace's draft": [draft("grace"), "its registry is disposed"],
			"the attached roots": [attachedRoots(), []],
		});
	},
);
