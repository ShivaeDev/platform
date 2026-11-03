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
	function* ({ addResource, exists, file }) {
		const modules = yield* file("src/server/modules.ts");

		const answer = yield* addResource("../escaped");

		expect(answer).toBe("create-app: Use a lowercase resource name with optional hyphens, at most 63 characters long.");
		yield* outcomes([
			["module list", () => file("src/server/modules.ts"), modules],
			["escaped files", () => exists("src/escaped"), false],
		]);
	},
);

application.it(
	"resource generation names every existing destination and leaves the module list and files alone",
	[
		generated("my-app", "--no-git", "--minimal"),
		appAdds("src/modules/bookmarks/bookmarks.ts", "custom contract\n"),
		appAdds("src/modules/bookmarks/client/make.ts", "custom client\n"),
	],
	function* ({ addResource, file, exists }) {
		const modules = yield* file("src/server/modules.ts");

		const answer = yield* addResource("bookmarks");

		expect(answer).toBe(
			"create-app: Refusing to overwrite existing files:\nsrc/modules/bookmarks/bookmarks.ts\nsrc/modules/bookmarks/client/make.ts",
		);
		yield* outcomes([
			["module list", () => file("src/server/modules.ts"), modules],
			["contract", () => file("src/modules/bookmarks/bookmarks.ts"), "custom contract\n"],
			["client", () => file("src/modules/bookmarks/client/make.ts"), "custom client\n"],
			["service", () => exists("src/modules/bookmarks/server/Service.ts"), false],
		]);
	},
);

application.it(
	"a customized module list is named and left alone when resource registration cannot be placed",
	[generated("my-app", "--no-git"), appAdds("src/server/modules.ts", "export const customModules = [];\n")],
	function* ({ addResource, file, exists }) {
		const answer = yield* addResource("bookmarks");

		expect(answer).toBe("create-app: Cannot register bookmarks: src/server/modules.ts must declare const modules = [...] as const;");
		yield* outcomes([
			["custom list", () => file("src/server/modules.ts"), "export const customModules = [];\n"],
			["resource", () => exists("src/modules/bookmarks"), false],
		]);
	},
);

application.it(
	"running the same resource command again names existing files and preserves the first resource",
	[generated("my-app", "--no-git", "--minimal")],
	function* ({ addResource, file }) {
		expect(yield* addResource("bookmarks")).toBe("added");
		const modules = yield* file("src/server/modules.ts");
		const contract = yield* file("src/modules/bookmarks/bookmarks.ts");

		const answer = yield* addResource("bookmarks");

		expect(answer).toContain("create-app: Refusing to overwrite existing files:\nsrc/modules/bookmarks/bookmarks.ts");
		yield* outcomes([
			["module list", () => file("src/server/modules.ts"), modules],
			["contract", () => file("src/modules/bookmarks/bookmarks.ts"), contract],
		]);
	},
);
