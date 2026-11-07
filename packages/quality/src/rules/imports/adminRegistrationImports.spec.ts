import { importsAliased } from "#rules/imports/aliased.ts";
import { importStory, repositoryHas } from "#test/importStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

for (const directory of ["", "packages/app/"]) {
	for (const module of ["inbox", "admin/inbox"]) {
		for (const runtime of ["client", "server"]) {
			const folder = `${directory}src/modules/${module}/${runtime}`;
			importStory.it(
				`imports/aliased reports the registration's own relative admin imports in ${folder}`,
				[
					repositoryHas(
						{ content: 'import "./admin/registration.ts";\nimport "./admin/inbox/routes.ts";', path: `${folder}/registration.tsx` },
						{ content: "export const adminRegistration = {};", path: `${folder}/admin/registration.ts` },
						{ content: "export const inboxRoutes = [];", path: `${folder}/admin/inbox/routes.ts` },
					),
				],
				function* ({ check, sites }) {
					yield* check(importsAliased);

					yield* assertThat(yield* sites(), (actual) =>
						actual.toEqual([`${folder}/registration.tsx:1 ./admin/registration.ts`, `${folder}/registration.tsx:2 ./admin/inbox/routes.ts`]),
					);
				},
			);
		}
	}
}

for (const [from, specifier, target] of [
	["src/modules/inbox/client/view.ts", "./admin/routes.ts", "src/modules/inbox/client/admin/routes.ts"],
	["src/modules/inbox/server/registration.ts", "./queries/read.ts", "src/modules/inbox/server/queries/read.ts"],
	["src/modules/inbox/client/registration.ts", "../../other/client/admin/routes.ts", "src/modules/other/client/admin/routes.ts"],
	["src/client/registration.ts", "./admin/routes.ts", "src/client/admin/routes.ts"],
	["src/modules/inbox/client/admin/registration.ts", "./views/page.ts", "src/modules/inbox/client/admin/views/page.ts"],
	["src/modules/inbox/client/registration.ts", "./admin/../views/page.ts", "src/modules/inbox/client/views/page.ts"],
] as const) {
	importStory.it(
		`imports/aliased still reports ${specifier} from ${from}`,
		[repositoryHas({ content: `import "${specifier}";`, path: from }, { content: "export const value = 1;", path: target })],
		function* ({ check, sites }) {
			yield* check(importsAliased);

			yield* assertThat(yield* sites(), (actual) => actual.toEqual([`${from}:1 ${specifier}`]));
		},
	);
}
