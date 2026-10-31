import { expect } from "vitest";
import { importsRuntime } from "#rules/imports/runtime.ts";
import { brokenModuleImports, groupedModules } from "#test/groupedModules.ts";
import { importStory, repositoryHas } from "#test/importStory.ts";

for (const directory of ["", "packages/app/"]) {
	const workspace = repositoryHas(
		{ content: '{"workspaces":["packages/*"]}', path: "package.json" },
		{ content: '{"name":"app"}', path: `${directory}package.json` },
		...groupedModules(directory),
	);
	importStory.it(
		`imports/runtime accepts client, server and test support in grouped and ungrouped modules under ${directory || "the root"}`,
		[workspace],
		function* ({ check }) {
			const findings = yield* check(importsRuntime);

			expect(findings).toEqual([]);
		},
	);

	importStory.it(
		`imports/runtime reports the same forbidden imports in grouped and ungrouped modules under ${directory || "the root"}`,
		[workspace, repositoryHas(...brokenModuleImports(directory))],
		function* ({ check, sites }) {
			yield* check(importsRuntime);

			expect(yield* sites()).toEqual([
				`${directory}src/modules/admin/teams/broken.ts:1 ./client/view.ts`,
				`${directory}src/modules/admin/teams/broken.ts:2 ./server/db.ts`,
				`${directory}src/modules/admin/teams/client/broken.ts:1 ../server/db.ts`,
				`${directory}src/modules/admin/teams/client/broken.ts:2 node:fs`,
				`${directory}src/modules/admin/users/broken.ts:1 ./client/view.ts`,
				`${directory}src/modules/admin/users/broken.ts:2 ./server/db.ts`,
				`${directory}src/modules/admin/users/client/broken.ts:1 ../server/db.ts`,
				`${directory}src/modules/admin/users/client/broken.ts:2 node:fs`,
				`${directory}src/modules/users/broken.ts:1 ./client/view.ts`,
				`${directory}src/modules/users/broken.ts:2 ./server/db.ts`,
				`${directory}src/modules/users/client/broken.ts:1 ../server/db.ts`,
				`${directory}src/modules/users/client/broken.ts:2 node:fs`,
			]);
		},
	);
}
