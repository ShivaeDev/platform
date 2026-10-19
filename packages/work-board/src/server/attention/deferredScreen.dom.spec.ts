import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const PLANNED =
	'---\nid: goal.admin\nkind: project\nstatus: planned\nowner: Casey\nnext_action: "Later: design the admin system"\n---\n# Admin system\n';
screenStory.it(
	"moves deferred person-owned work out of Needs you into collapsed Later",
	[routedScreen({ "goals/admin.md": PLANNED, "home.md": "# Home" }, "/")],
	function* ({ editFile, refreshToday, refreshDocument, readText, findElement }) {
		yield* Effect.promise(() => eventually(() => expect(readText('ul[aria-label="Needs you"]')).toContain("Casey: Later: design the admin system")));
		expect(findElement("#later")).toBeNull();
		editFile("goals/admin.md", PLANNED.replace("status: planned", "status: deferred"));
		yield* Effect.promise(() => refreshToday());
		yield* Effect.promise(() => refreshDocument());
		yield* Effect.promise(() => eventually(() => expect(readText("#later")).toContain("Later: design the admin system")));
		expect(readText('ul[aria-label="Needs you"]') ?? "").not.toContain("Admin system");
		expect(readText("#inbox-count")).toBe("0");
		expect(readText("#later summary")).toBe("Later1");
		expect(findElement("#later details")).toHaveProperty("open", false);
	},
);
