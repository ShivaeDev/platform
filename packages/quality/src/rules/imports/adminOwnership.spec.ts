import { expect } from "vitest";
import { importStory, repositoryHas } from "#test/importStory.ts";
import { adminPaths } from "./adminPaths.ts";

for (const directory of ["", "packages/app/"]) {
	importStory.it(
		`admin registration dependencies outside admin/ name their destination in ${directory || "the root"}`,
		[
			repositoryHas(
				{ content: 'import "./adminRegistration.ts";', path: `${directory}src/modules/notes/server/registration.ts` },
				{
					content:
						'import { registerAdmin as register } from "@shivaedev/admin/server/registerAdmin.ts";\nimport "./queries/read.ts";\nexport const statistics = register();',
					path: `${directory}src/modules/notes/server/adminRegistration.ts`,
				},
				{ content: "export const read = 1;", path: `${directory}src/modules/notes/server/queries/read.ts` },
			),
		],
		function* ({ check, findings }) {
			yield* check(adminPaths);

			expect(yield* findings()).toEqual([
				{
					file: `${directory}src/modules/notes/server/adminRegistration.ts`,
					message: `Only admin permissions or registrations reach this file. Move it to ${directory}src/modules/notes/server/admin/.`,
				},
				{
					file: `${directory}src/modules/notes/server/queries/read.ts`,
					message: `Only admin permissions or registrations reach this file. Move it to ${directory}src/modules/notes/server/admin/queries/.`,
				},
			]);
		},
	);
}

importStory.it(
	"an admin permission identifies a misplaced guarded handler",
	[
		repositoryHas(
			{
				content:
					'import { requirePermission as demand } from "@shivaedev/identity/permission.ts";\nimport { ReadStatistics } from "../../admin/permissions.ts";\nexport const handler = () => demand(ReadStatistics);',
				path: "src/modules/notes/server/handler.ts",
			},
			{ content: "export const ReadStatistics = {};", path: "src/modules/admin/permissions.ts" },
		),
	],
	function* ({ check, messages }) {
		yield* check(adminPaths);

		expect(yield* messages()).toEqual(["Only admin permissions or registrations reach this file. Move it to src/modules/notes/server/admin/."]);
	},
);

importStory.it(
	"member reach through a helper reports admin implementations with a member destination",
	[
		repositoryHas(
			{ content: 'import "./helper.ts";', path: "src/modules/notes/client/Screen.ts" },
			{ content: 'export { view } from "./admin/View.ts";', path: "src/modules/notes/client/helper.ts" },
			{ content: "export const view = 1;", path: "src/modules/notes/client/admin/View.ts" },
		),
	],
	function* ({ check, findings }) {
		yield* check(adminPaths);

		expect(yield* findings()).toEqual([
			{ file: "src/modules/notes/client/admin/View.ts", message: "Member code reaches this admin/ file. Move it to src/modules/notes/client/." },
		]);
	},
);

importStory.it(
	"a member module composes its admin subfolder and shares member persistence",
	[
		repositoryHas(
			{ content: 'import "./admin/registration.ts";\nimport "./member.ts";', path: "src/modules/notes/server/registration.ts" },
			{ content: 'import "./repository.ts";', path: "src/modules/notes/server/member.ts" },
			{ content: "export const repository = {};", path: "src/modules/notes/server/repository.ts" },
			{ content: 'import "./read.ts";\nexport const adminRegistration = {};', path: "src/modules/notes/server/admin/registration.ts" },
			{ content: 'import "../repository.ts";', path: "src/modules/notes/server/admin/read.ts" },
			{
				content: 'import { adminPage } from "@shivaedev/admin/page.ts";\nexport const page = adminPage();',
				path: "src/modules/notes/admin/pages.ts",
			},
			{ content: 'import "../member.ts";', path: "src/modules/notes/server/admin/read.spec.ts" },
		),
	],
	function* ({ check, findings }) {
		yield* check(adminPaths);

		expect(yield* findings()).toEqual([]);
	},
);

importStory.it(
	"whole admin modules and literal dynamic imports retain reachability across cycles",
	[
		repositoryHas(
			{ content: 'export const load = () => import("../../../users/client/View.ts");', path: "src/modules/admin/users/client/registration.ts" },
			{ content: 'import "./helper.ts";\nexport const view = 1;', path: "src/modules/users/client/View.ts" },
			{ content: 'import "./View.ts";', path: "src/modules/users/client/helper.ts" },
		),
	],
	function* ({ check, files }) {
		yield* check(adminPaths);

		expect(yield* files()).toEqual(["src/modules/users/client/View.ts", "src/modules/users/client/helper.ts"]);
	},
);

importStory.it(
	"a member type import also names the shared destination for an admin file",
	[
		repositoryHas(
			{ content: 'import type { Page } from "./admin/page.ts";\nexport const member = 1;', path: "src/member.ts" },
			{ content: "export interface Page { readonly id: string }", path: "src/admin/page.ts" },
		),
	],
	function* ({ check, findings }) {
		yield* check(adminPaths);

		expect(yield* findings()).toEqual([{ file: "src/admin/page.ts", message: "Member code reaches this admin/ file. Move it to src/." }]);
	},
);

importStory.it(
	"test consumers do not turn admin implementations into member code",
	[
		repositoryHas(
			{ content: "export const page = {};", path: "src/admin/page.ts" },
			{ content: 'import "./admin/page.ts";', path: "src/page.spec.ts" },
		),
	],
	function* ({ check, findings }) {
		yield* check(adminPaths);

		expect(yield* findings()).toEqual([]);
	},
);

importStory.it(
	"member registration composition cannot import an admin view directly",
	[
		repositoryHas(
			{ content: 'import "./admin/View.ts";', path: "src/modules/notes/client/registration.ts" },
			{ content: "export const view = 1;", path: "src/modules/notes/client/admin/View.ts" },
		),
	],
	function* ({ check, messages }) {
		yield* check(adminPaths);

		expect(yield* messages()).toEqual(["Member code reaches this admin/ file. Move it to src/modules/notes/client/."]);
	},
);

importStory.it(
	"a misplaced admin page and its aliased dependency belong in admin folders",
	[
		repositoryHas(
			{ content: '{"compilerOptions":{"paths":{"#*": ["./src/*"]}}}', path: "tsconfig.json" },
			{
				content:
					'import { adminPage as page } from "@shivaedev/admin/page.ts";\nimport "#modules/notes/schema.ts";\nexport const statistics = page();',
				path: "src/modules/notes/pages.ts",
			},
			{ content: "export const schema = {};", path: "src/modules/notes/schema.ts" },
		),
	],
	function* ({ check, messages }) {
		yield* check(adminPaths);

		expect(yield* messages()).toEqual([
			"Only admin permissions or registrations reach this file. Move it to src/modules/notes/admin/.",
			"Only admin permissions or registrations reach this file. Move it to src/modules/notes/admin/.",
		]);
	},
);

importStory.it(
	"curried permission middleware identifies an admin-only module outside admin paths",
	[
		repositoryHas(
			{
				content:
					'import { permissionMiddleware } from "@shivaedev/identity/permission.ts";\nimport { ReadStatistics } from "../../admin/permissions.ts";\nexport class StatisticsPermission extends permissionMiddleware<StatisticsPermission>()("Statistics", ReadStatistics) {}',
				path: "src/modules/notes/StatisticsPermission.ts",
			},
			{ content: "export const ReadStatistics = {};", path: "src/admin/permissions.ts" },
		),
	],
	function* ({ check, messages }) {
		yield* check(adminPaths);

		expect(yield* messages()).toEqual(["Only admin permissions or registrations reach this file. Move it to src/modules/notes/admin/."]);
	},
);

importStory.it(
	"a member consumer of a whole admin module names the matching member module folder",
	[
		repositoryHas(
			{ content: 'import "../../admin/users/client/View.ts";', path: "src/modules/notes/client/Screen.ts" },
			{ content: "export const view = 1;", path: "src/modules/admin/users/client/View.ts" },
		),
	],
	function* ({ check, messages }) {
		yield* check(adminPaths);

		expect(yield* messages()).toEqual(["Member code reaches this admin/ file. Move it to src/modules/users/client/."]);
	},
);
