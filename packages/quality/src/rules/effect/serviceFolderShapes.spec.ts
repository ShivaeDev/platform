import { expect } from "@effect/vitest";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { serviceFolderFile } from "#test/serviceFolderFile.ts";
import { serviceFolders } from "./serviceFolders.ts";

ruleStory.it(
	"service folders accepts one exported defineService const and type exports",
	[
		repositoryHas(
			serviceFolderFile(
				'export interface MailOptions {}\nexport type Name = string;\nexport const Mail = service({ id: "app/Mail", methods: () => ({}) });',
			),
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceFolders);

		expect(findings).toEqual([]);
	},
);

ruleStory.it(
	"service folders reports a folder with operations but no service.ts",
	[repositoryHas({ content: "export const send = 1;", path: "src/services/mail/send.ts" })],
	function* ({ check }) {
		const findings = yield* check(serviceFolders);

		expect(findings).toEqual([
			{
				file: "src/services/mail",
				message: "Give this service folder a service.ts that exports its defineService declaration. Keep operations in focused sibling files.",
			},
		]);
	},
);

for (const exported of ['export type { Name } from "./name.ts";', 'export { type Name } from "./name.ts";']) {
	ruleStory.it(
		`service folders accepts the type-only re-export ${exported}`,
		[repositoryHas(serviceFolderFile(`export const Mail = service({ id: "app/Mail" }); ${exported}`))],
		function* ({ check }) {
			const findings = yield* check(serviceFolders);

			expect(findings).toEqual([]);
		},
	);
}

for (const [name, code] of [
	["a hidden service", 'const Mail = service({ id: "app/Mail" });'],
	["a default export", 'export default service({ id: "app/Mail" });'],
	["a mutable service", 'export let Mail = service({ id: "app/Mail" });'],
	["an unrelated export", "export const Mail = {};"],
	["an additional runtime export", 'export const Mail = service({ id: "app/Mail" }); export const other = 1;'],
	["two services", 'export const Mail = service({ id: "app/Mail" }); const Other = service({ id: "app/Other" });'],
	["a runtime re-export", 'export const Mail = service({ id: "app/Mail" }); export { send } from "./send.ts";'],
	["a mixed re-export", 'export const Mail = service({ id: "app/Mail" }); export { type Name, send } from "./send.ts";'],
] as const) {
	ruleStory.it(`service folders reports ${name}`, [repositoryHas(serviceFolderFile(code))], function* ({ check }) {
		const findings = yield* check(serviceFolders);

		expect(findings).toEqual([
			{
				file: "src/services/mail/service.ts",
				line: 1,
				message:
					"Export exactly one named const initialized by a direct defineService call from service.ts. Move other runtime exports to their own files; type exports may stay.",
			},
		]);
	});
}

ruleStory.it(
	"service folders leaves files outside the services grouping alone",
	[repositoryHas(serviceFolderFile("export const broken = {};", "src/mail/service.ts"))],
	function* ({ check, locations }) {
		yield* check(serviceFolders);

		expect(yield* locations()).toEqual([]);
	},
);

ruleStory.it(
	"service folders discovers defineService declarations outside services grouping",
	[repositoryHas(serviceFolderFile('export const Mail = service({ id: "app/Mail" });', "src/mail/Mail.ts"))],
	function* ({ check }) {
		const findings = yield* check(serviceFolders);

		expect(findings).toEqual([
			{
				file: "src/mail",
				message: "Give this service folder a service.ts that exports its defineService declaration. Keep operations in focused sibling files.",
			},
		]);
	},
);

ruleStory.it(
	"a service folder cannot hide another declaration beside service.ts",
	[
		repositoryHas(
			serviceFolderFile('export const Mail = service({ id: "app/Mail" });', "src/mail/service.ts"),
			serviceFolderFile('export const Other = service({ id: "app/Other" });', "src/mail/Other.ts"),
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceFolders);

		expect(findings).toEqual([
			{
				file: "src/mail/Other.ts",
				message:
					"Give each service its own folder and move this declaration to its service.ts. Keep that service's operations in focused sibling files.",
			},
		]);
	},
);
