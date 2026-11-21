import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { appOpen, clientApps } from "#test/client-app/story.tsx";

clientApps.it(
	"the connection hands the shell every module's menu entries, overlays and footer in module order",
	[appOpen("two modules with every shell slot around one with none", "alice")],
	function* ({ footers, menu, overlays }) {
		yield* outcomes([
			["menu entries", () => menu(), ["First menu", "First second menu", "Second menu", "Second second menu"]],
			["overlays", () => overlays(), ["First overlay", "Second overlay"]],
			["footers", () => footers(), ["First footer", "Second footer"]],
		]);
	},
);

for (const viewer of ["alice", undefined] as const) {
	clientApps.it(
		`a session-scoped contract answers in the rendering registry for ${viewer ?? "a signed-out visitor"}`,
		[appOpen("a session-scoped profile", viewer)],
		function* ({ viewer: shown }) {
			expect(yield* shown()).toBe(`read for ${viewer ?? "a visitor"}`);
		},
	);
}

clientApps.it(
	"a contract two modules name is bound once, so a bump reads the count once and both modules show it",
	[appOpen("a counter both modules name", "alice")],
	function* ({ bump, count, countReads }) {
		yield* outcomes([
			["Tally", () => count("Tally"), "0"],
			["Summary", () => count("Summary"), "0"],
			["count reads", () => countReads(), 1],
		]);

		yield* bump();

		yield* outcomes([
			["Tally", () => count("Tally"), "1"],
			["Summary", () => count("Summary"), "1"],
			["count reads", () => countReads(), 2],
		]);
	},
);
