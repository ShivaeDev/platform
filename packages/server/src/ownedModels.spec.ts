import { expect } from "vitest";
import { definedModulesHost } from "#test/defined-modules/story.ts";

definedModulesHost.it(
	"an operation served by the host reads exactly the owned models its repositories reported, with their tables and owner columns, and not the unowned one",
	[],
	function* ({ ownedModels }) {
		expect(yield* ownedModels()).toEqual([
			{ column: "ownerId", table: "notebooks" },
			{ column: "userId", table: "reminders" },
		]);
	},
);
