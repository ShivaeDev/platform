import { expect } from "vitest";
import { namedAfterExport } from "#rules/files/namedAfterExport.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const directory of ["", "packages/app/"]) {
	for (const module of ["inbox", "admin/inbox"]) {
		for (const runtime of ["client", "server"]) {
			const folder = `${directory}src/modules/${module}/${runtime}/admin`;
			ruleStory.it(
				`files/named-after-export accepts specific and generic admin export names in ${folder}`,
				[
					repositoryHas(
						{ content: "export const inboxRoutes = [];", path: `${folder}/inboxRoutes.ts` },
						{ content: "export const inboxHandlers = {};", path: `${folder}/inboxHandlers.ts` },
						{ content: "export const inboxRoutes = [];", path: `${folder}/routes.ts` },
						{ content: "export const adminHandlers = {};", path: `${folder}/handlers.ts` },
					),
				],
				function* ({ check, findings }) {
					yield* check(namedAfterExport);

					expect(yield* findings()).toEqual([]);
				},
			);
		}
	}
}

for (const [path, content, reason] of [
	["src/modules/inbox/client/admin/wrong.ts", "export const inboxRoutes = [];", '"wrong" does not name its export inboxRoutes.'],
	["src/modules/inbox/server/admin/wrong.ts", "export const inboxHandlers = {};", '"wrong" does not name its export inboxHandlers.'],
	["src/modules/inbox/client/admin/routes.ts", "export const unrelatedRoutes = [];", '"routes" does not name its export unrelatedRoutes.'],
	["src/modules/inbox/client/admin/InboxRoutes.ts", "export const inboxRoutes = [];", '"InboxRoutes" does not name its export inboxRoutes.'],
	["src/modules/inbox/client/inboxRoutes.ts", "export const inboxRoutes = [];", '"inboxRoutes" repeats its folder "inbox".'],
	["src/modules/inbox/server/admin/inbox/inboxRoutes.ts", "export const inboxRoutes = [];", '"inboxRoutes" repeats its folder "inbox".'],
	["src/other/client/admin/otherRoutes.ts", "export const otherRoutes = [];", '"otherRoutes" repeats its folder "other".'],
] as const) {
	ruleStory.it(`files/named-after-export still reports ${path}: ${reason}`, [repositoryHas({ content, path })], function* ({ check, messages }) {
		yield* check(namedAfterExport);

		expect(yield* messages()).toEqual([expect.stringContaining(reason)]);
	});
}
