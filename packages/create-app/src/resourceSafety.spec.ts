import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import { appAdds, generated } from "#test/traits.ts";

application.it(
	"a resource command outside a generated app explains the missing generation record and writes no module",
	[],
	function* ({ addResourceOutsideApp, workspaceHas }) {
		const answer = yield* addResourceOutsideApp("bookmarks");

		yield* outcomes([
			["command answer", () => Effect.succeed(answer), "create-app: Run create-app resource from a generated app (.create-app.json is missing)."],
			["module files", () => workspaceHas("src/modules/bookmarks"), false],
		]);
	},
);

application.it(
	"a resource name containing a parent path is refused before writing outside the module folder",
	[generated("my-app", "--no-git", "--minimal")],
	function* ({ addResource, exists }) {
		const answer = yield* addResource("../escaped");

		expect(answer).toBe("create-app: Use a lowercase resource name with optional hyphens, at most 63 characters long.");
		expect(yield* exists("src/escaped")).toBe(false);
	},
);

application.it(
	"resource generation names every existing destination and leaves the files alone",
	[
		generated("my-app", "--no-git", "--minimal"),
		appAdds("src/modules/bookmarks/Bookmarks.ts", "custom module\n"),
		appAdds("src/modules/bookmarks/model.ts", "custom model\n"),
	],
	function* ({ addResource, file, exists }) {
		const answer = yield* addResource("bookmarks");

		expect(answer).toBe("create-app: Refusing to overwrite existing files:\nsrc/modules/bookmarks/Bookmarks.ts\nsrc/modules/bookmarks/model.ts");
		yield* outcomes([
			["module", () => file("src/modules/bookmarks/Bookmarks.ts"), "custom module\n"],
			["model", () => file("src/modules/bookmarks/model.ts"), "custom model\n"],
			["operation", () => exists("src/modules/bookmarks/server/Create.ts"), false],
		]);
	},
);

application.it(
	"running the same resource command again names existing files and preserves the first resource",
	[generated("my-app", "--no-git", "--minimal")],
	function* ({ addResource, file }) {
		expect(yield* addResource("bookmarks")).toBe("added");
		const module = yield* file("src/modules/bookmarks/Bookmarks.ts");

		const answer = yield* addResource("bookmarks");

		expect(answer).toContain("create-app: Refusing to overwrite existing files:\nsrc/modules/bookmarks/Bookmarks.ts");
		expect(yield* file("src/modules/bookmarks/Bookmarks.ts")).toBe(module);
	},
);

application.it(
	"a resource in a minimal app is a defined module with one file per operation under server/ and a client module, registered by its folder alone, and leaves the Quality config and both module compositions unchanged",
	[generated("my-app", "--no-git", "--minimal")],
	function* ({ addResource, file, fileMentions, filesUnder }) {
		const qualityConfig = yield* file("quality.config.ts");
		const composition = yield* file("src/server/modules.ts");
		const clientComposition = yield* file("src/client/modules.ts");

		yield* addResource("reading-lists");

		yield* outcomes([
			[
				"module files",
				() => filesUnder("src/modules/reading-lists"),
				[
					"ReadingLists.ts",
					"client/Screen.tsx",
					"client/list.dom.spec.ts",
					"client/module.tsx",
					"model.ts",
					"server/Create.ts",
					"server/List.ts",
					"server/Repository.ts",
					"server/lifecycle.spec.ts",
					"server/migrations/0006_reading_lists.ts",
					"server/registration.ts",
					"test-support/application.ts",
					"test-support/screen.ts",
				],
			],
			["registration names the module", () => fileMentions("src/modules/reading-lists/server/registration.ts", "module: ReadingLists,"), true],
			[
				"registration written satisfies AppModule",
				() => fileMentions("src/modules/reading-lists/server/registration.ts", "} satisfies AppModule;"),
				true,
			],
			["Quality config", () => file("quality.config.ts"), qualityConfig],
			[
				"client module exported",
				() => fileMentions("src/modules/reading-lists/client/module.tsx", "export const readingListsModule = clientModule("),
				true,
			],
			["server module composition", () => file("src/server/modules.ts"), composition],
			["client module composition", () => file("src/client/modules.ts"), clientComposition],
		]);
	},
);
