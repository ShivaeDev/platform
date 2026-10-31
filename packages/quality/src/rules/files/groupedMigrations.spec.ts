import { expect } from "vitest";
import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const directory of ["", "packages/app/"]) {
	ruleStory.it(
		`files/named-after-export accepts numbered migrations only in module server migration folders under ${directory || "the root"}`,
		[
			repositoryHas(
				...["users", "admin/users", "admin/area/users"].flatMap((module) =>
					["server/migrations", "client/migrations", "server/migrations/nested"].map((folder) => ({
						content: "export default 1;",
						path: `${directory}src/modules/${module}/${folder}/0001_accounts.ts`,
					})),
				),
			),
		],
		function* ({ check, locations }) {
			yield* check(namedAfterExport);

			expect(yield* locations()).toEqual([
				`${directory}src/modules/admin/area/users/client/migrations/0001_accounts.ts`,
				`${directory}src/modules/admin/area/users/server/migrations/0001_accounts.ts`,
				`${directory}src/modules/admin/area/users/server/migrations/nested/0001_accounts.ts`,
				`${directory}src/modules/admin/users/client/migrations/0001_accounts.ts`,
				`${directory}src/modules/admin/users/server/migrations/nested/0001_accounts.ts`,
				`${directory}src/modules/users/client/migrations/0001_accounts.ts`,
				`${directory}src/modules/users/server/migrations/nested/0001_accounts.ts`,
			]);
		},
	);
}
