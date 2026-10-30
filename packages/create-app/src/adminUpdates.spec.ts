import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { updates } from "#test/updates.ts";
import { AS_RELEASED, appCommits, createdWith010, published010, starterAt010, starterAt020 } from "#test/updateTraits.ts";

const SHELL = "src/client/admin/Shell.tsx";
const PAGES = "src/foundationPages.ts";
const DASHBOARD = [
	"src/server/checkDashboardVersion.ts",
	"src/server/jobDashboard.ts",
	"src/server/readOnlyDashboard.ts",
	"src/server/readOnlyDashboardWorker.ts",
];
const USERS_IMPORT = 'import { usersPage } from "@shivaedev/admin/users/page.ts"';
const retitled = appCommits("retitles its admin shell Acme operations", { [SHELL]: (shell) => shell.replace("Your app", "Acme operations") });
const shipsDashboard = starterAt010(
	"still ships the old dashboard",
	Object.fromEntries(DASHBOARD.map((path) => [path, "export const dashboard = true;\n"])),
);
const dropsDashboard = Object.fromEntries(DASHBOARD.map((path) => [path, null]));

updates.it(
	"update registers the 0.2.0 Users page in the foundation and keeps my-app's admin title",
	[
		starterAt010("registers no Users page", {
			[PAGES]: (pages) =>
				pages
					.replace(/^import \{ usersPage \}.*\n/gmu, "")
					.replace(/^const UsersPage =.*\n/gmu, "")
					.replace("adminRegistry(JobsPage, UsersPage)", "adminRegistry(JobsPage)"),
		}),
		createdWith010(),
		published010,
		retitled,
		starterAt020("registers the Users page", { [PAGES]: AS_RELEASED }),
	],
	function* ({ fileMentions, update }) {
		yield* outcomes({
			"admin title": [fileMentions(SHELL, "Acme operations"), true],
			"Users import": [fileMentions(PAGES, USERS_IMPORT), false],
			"Users registered": [fileMentions(PAGES, "adminRegistry(JobsPage, UsersPage)"), false],
		});

		yield* update();

		yield* outcomes({
			"admin title": [fileMentions(SHELL, "Acme operations"), true],
			"Users import": [fileMentions(PAGES, USERS_IMPORT), true],
			"Users registered": [fileMentions(PAGES, "adminRegistry(JobsPage, UsersPage)"), true],
		});
	},
);

updates.it(
	"update merges the starter's and my-app's edits to the admin shell, removes the old dashboard and records 0.2.0",
	[
		shipsDashboard,
		createdWith010(),
		published010,
		retitled,
		starterAt020("renames the shell's Administration label Operator tools and drops the old dashboard", {
			...dropsDashboard,
			[SHELL]: (shell) => shell.replace("Administration</p>", "Operator tools</p>"),
		}),
	],
	function* ({ fileMentions, filesPresent, generationRecord, update }) {
		expect(yield* filesPresent(DASHBOARD)).toEqual(DASHBOARD);

		yield* update();

		yield* outcomes({
			".create-app.json": [generationRecord(), { name: "my-app", version: "0.2.0" }],
			"admin title": [fileMentions(SHELL, "Acme operations"), true],
			"dashboard files left": [filesPresent(DASHBOARD), []],
			"Operator tools label": [fileMentions(SHELL, "Operator tools</p>"), true],
		});
	},
);

updates.it(
	"update lists an overlapping admin shell edit as a conflict, still removes the old dashboard and keeps 0.1.0 recorded",
	[
		shipsDashboard,
		createdWith010(),
		published010,
		retitled,
		starterAt020("retitles the shell New app name and drops the old dashboard", {
			...dropsDashboard,
			[SHELL]: (shell) => shell.replace("Your app", "New app name"),
		}),
	],
	function* ({ answer, conflictedFiles, fileMentions, filesPresent, generationRecord, update }) {
		expect(yield* filesPresent(DASHBOARD)).toEqual(DASHBOARD);

		yield* update();

		yield* outcomes({
			".create-app.json": [generationRecord(), { name: "my-app", version: "0.1.0" }],
			answer: [answer(), `create-app: Resolve these conflicts, then commit your changes:\n${SHELL}\nThe recorded version remains 0.1.0.`],
			"conflict between both titles": [fileMentions(SHELL, "<<<<<<< ours"), true],
			"conflicted files": [conflictedFiles(), [SHELL]],
			"dashboard files left": [filesPresent(DASHBOARD), []],
			"my-app's title kept": [fileMentions(SHELL, "Acme operations"), true],
			"starter's title offered": [fileMentions(SHELL, "New app name"), true],
		});
	},
);

updates.it(
	"update brings the 0.2.0 permission imports into AppAccess.ts and keeps my-app's own grant in its Owner role",
	[
		starterAt010("declares only a user and an OpenAdmin admin role in AppAccess.ts", {
			"src/AppAccess.ts":
				'import { roleSet } from "@shivaedev/access/roleSet.ts";\nimport { role } from "@shivaedev/access/role.ts";\nimport { OpenAdmin } from "@shivaedev/admin/permissions.ts";\nexport const AppAccess = roleSet(role("user", []), role("admin", [OpenAdmin]));\n',
		}),
		createdWith010(),
		published010,
		appCommits("grants its Owner role ReadUsers.any", {
			"src/roles/Owner.ts": (owner) => owner.replace("[ReadUsers,", "[ReadUsers, ReadUsers.any,"),
		}),
		starterAt020("declares AppAccess.ts as released today", { "src/AppAccess.ts": AS_RELEASED }),
	],
	function* ({ file, fileMentions, starterFile, update }) {
		const released = yield* starterFile("src/AppAccess.ts");
		expect(yield* file("src/AppAccess.ts")).not.toBe(released);

		yield* update();

		yield* outcomes({
			"Owner keeps ReadUsers.any": [fileMentions("src/roles/Owner.ts", "ReadUsers.any"), true],
			"src/AppAccess.ts": [file("src/AppAccess.ts"), released],
		});
	},
);
