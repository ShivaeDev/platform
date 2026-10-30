import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { application } from "#test/application.ts";
import {
	configuredIdentity,
	creationFailedOnce,
	destination,
	enclosingRepository,
	guessableEmail,
	installationFails,
	missingGit,
} from "#test/traits.ts";

const NOT_EMPTY = "create-app: Refusing to write into my-app: the destination must be an empty folder.";

application.it("create-app apps/my-app names the app my-app after its final folder", [], function* ({ createApp, packageName }) {
	yield* createApp("apps/my-app");

	expect(yield* packageName()).toBe("my-app");
});

application.it("create-app apps/my-app prints next steps that cd into apps/my-app and run pnpm dev", [], function* ({ closingMessage, createApp }) {
	yield* createApp("apps/my-app");

	expect(yield* closingMessage()).toBe("Created apps/my-app.\n\nNext steps:\n  cd 'apps/my-app'\n  pnpm dev");
});

application.it(
	"the printed cd command reaches a folder whose path holds quotes, a space and a dollar sign",
	[],
	function* ({ createApp, printedCdLeadsTo }) {
		yield* createApp("parent 'quoted' $literal/my-app", "--no-git");

		expect(yield* printedCdLeadsTo()).toBe("parent 'quoted' $literal/my-app");
	},
);

application.it(
	"the initial commit falls back to Create App <create-app@localhost> instead of an identity Git guesses",
	[guessableEmail],
	function* ({ commits, createApp }) {
		yield* createApp("my-app");

		expect(yield* commits()).toEqual(["Create App <create-app@localhost>: Initialize a generated app"]);
	},
);

application.it("the initial commit keeps the author Git is configured with", [configuredIdentity], function* ({ commits, createApp }) {
	yield* createApp("my-app");

	expect(yield* commits()).toEqual(["App Author <author@example.com>: Initialize a generated app"]);
});

application.it(
	"the initial commit tracks the generated files and the installed lockfile, leaving only the ignored .env.local out",
	[],
	function* ({ createApp, gitState, uncommittedChanges }) {
		yield* createApp("my-app");

		yield* outcomes({
			".env.local": [gitState(".env.local"), "ignored"],
			".github/workflows/ci.yml": [gitState(".github/workflows/ci.yml"), "tracked"],
			"pnpm-lock.yaml": [gitState("pnpm-lock.yaml"), "tracked"],
			"uncommitted changes": [uncommittedChanges(), []],
		});
	},
);

for (const [why, given, flags] of [
	["--no-git", [], ["--no-git"]],
	["Git is not on the PATH", [missingGit], []],
] as const) {
	application.it(`create-app creates my-app without a repository when ${why}`, given, function* ({ answer, createApp, exists }) {
		yield* createApp("my-app", ...flags);

		yield* outcomes({
			".git in my-app": [exists(".git"), false],
			answer: [answer(), "created"],
		});
	});
}

application.it(
	"inside an enclosing repository, create-app neither nests a repository nor commits or stages in the enclosing one",
	[enclosingRepository],
	function* ({ createApp, enclosingCommits, enclosingStaged, exists }) {
		yield* createApp("apps/my-app");

		yield* outcomes({
			".git in my-app": [exists(".git"), false],
			"enclosing commits": [enclosingCommits(), []],
			"enclosing staged files": [enclosingStaged(), []],
		});
	},
);

application.it(
	"create-app accepts an empty my-app folder and creates the app in it",
	[destination("empty")],
	function* ({ answer, createApp, exists }) {
		yield* createApp("my-app", "--no-git");

		yield* outcomes({
			answer: [answer(), "created"],
			"src/modules/notes/notes.ts": [exists("src/modules/notes/notes.ts"), true],
		});
	},
);

for (const [kind, contents] of [
	["file", { ".": "user data" }],
	["nonempty", { ".keep": "user data" }],
	["environment", { ".env.local": "user settings" }],
] as const) {
	application.it(
		`create-app refuses a ${kind} destination and leaves it as it was, uninstalled`,
		[destination(kind)],
		function* ({ answer, createApp, destinationContents }) {
			yield* createApp("my-app");

			yield* outcomes({
				answer: [answer(), NOT_EMPTY],
				"my-app": [destinationContents(), contents],
			});
		},
	);
}

application.it(
	"a failed installation stops create-app with a retry instruction, before the initial commit, and keeps the generated files",
	[installationFails],
	function* ({ answer, commits, createApp, exists }) {
		yield* createApp("my-app");

		yield* outcomes({
			answer: [answer(), "create-app: pnpm run setup failed (exit 7). Run pnpm run setup in my-app to retry."],
			commits: [commits(), []],
			"package.json": [exists("package.json"), true],
		});
	},
);

application.it(
	"after a failed installation, running create-app my-app again refuses the folder and keeps its .env.local",
	[installationFails, creationFailedOnce],
	function* ({ answer, createApp, file }) {
		const environment = yield* file(".env.local");
		expect(environment).toMatch(/^DATABASE_URL=/u);

		yield* createApp("my-app", "--no-git");

		yield* outcomes({
			".env.local": [file(".env.local"), environment],
			answer: [answer(), NOT_EMPTY],
		});
	},
);

for (const name of ["Bad Name", "node_modules", "favicon.ico"]) {
	application.it(`create-app refuses the folder name "${name}" and creates no folder`, [], function* ({ answer, createApp, workspaceHas }) {
		yield* createApp(name);

		yield* outcomes({
			answer: [answer(), "create-app: The final folder name must be a lowercase npm package name."],
			[name]: [workspaceHas(name), false],
		});
	});
}

application.it(
	"create-app refuses a folder name of 215 characters, one more than npm allows, and creates no folder",
	[],
	function* ({ answer, createApp, workspaceHas }) {
		const name = "a".repeat(215);

		yield* createApp(name);

		yield* outcomes({
			answer: [answer(), "create-app: The final folder name must be a lowercase npm package name."],
			folder: [workspaceHas(name), false],
		});
	},
);
