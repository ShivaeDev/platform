import { expect } from "vitest";
import { docsReferences } from "#rules/docs/references.ts";
import { docsWorkspace, guide, markdown, noModule } from "#test/docsRepository.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const MODULES = [
	...docsWorkspace,
	{ content: 'export { makeRepository } from "./repository.ts";\n', path: "packages/lib/src/forwarded.ts" },
	{ content: JSON.stringify({ exports: { "./run.ts": "./src/run.ts" }, name: "@acme/tool" }), path: "packages/tool/package.json" },
	{ content: "export default function run(): number {\n\treturn 1;\n}\n", path: "packages/tool/src/run.ts" },
	{ content: "export const stop = 1;\n", path: "packages/tool/src/stop.ts" },
	{ content: "export const main = 1;\n", path: "packages/app/main.ts" },
];

const REPOSITORY = "packages/lib/src/repository.ts";

const BROKEN_REFERENCES = [
	{
		document: guide("```ts", 'import { missingName } from "@acme/lib/repository.ts";', "```"),
		line: 6,
		message: `"@acme/lib/repository.ts" does not export missingName. Name an export of ${REPOSITORY}, or the module that exports missingName.`,
		name: "a code import of a name the module does not export",
		subject: "@acme/lib/repository.ts",
	},
	{
		document: guide("```ts", 'import makeRepository from "@acme/lib/repository.ts";', "```"),
		line: 6,
		message: `"@acme/lib/repository.ts" has no default export. Import a named export of ${REPOSITORY}, or the module whose default export you mean.`,
		name: "a default import of a module without a default export",
		subject: "@acme/lib/repository.ts",
	},
	{
		document: guide("```js", 'import { lost } from "@acme/lib/lost.ts";', "```"),
		line: 6,
		message: noModule("@acme/lib/lost.ts", "@acme/lib"),
		name: "a JavaScript code import of a module the package does not have",
		subject: "@acme/lib/lost.ts",
	},
	{
		document: guide("Call `nothing` from `@acme/lib/repository.ts`."),
		line: 5,
		message: `"@acme/lib/repository.ts" does not export nothing. Name an export of ${REPOSITORY}, or the module that exports nothing.`,
		name: "a name in prose that its module does not export",
		subject: "@acme/lib/repository.ts",
	},
	{
		document: guide("Skip `@acme/lib/gone.ts`."),
		line: 5,
		message: noModule("@acme/lib/gone.ts", "@acme/lib"),
		name: "a module path in inline code that names no module",
		subject: "@acme/lib/gone.ts",
	},
	{
		document: markdown(
			"packages/lib/README.md",
			"# @acme/lib",
			"",
			"### API",
			"",
			"| Module | Exports |",
			"| --- | --- |",
			"| `absent.ts` | `absent` |",
		),
		line: 7,
		message: noModule("@acme/lib/absent.ts", "@acme/lib"),
		name: "a row of a package README's API table that names no module of the package",
		subject: "@acme/lib/absent.ts",
	},
	{
		document: guide("```ts", 'import { stop } from "@acme/tool/stop.ts";', "```"),
		line: 6,
		message: noModule("@acme/tool/stop.ts", "@acme/tool"),
		name: "a module path that no key of its package's exports map maps, though the file exists",
		subject: "@acme/tool/stop.ts",
	},
	{
		document: guide("```ts", 'import { start } from "@acme/app/start.ts";', "```"),
		line: 6,
		message: noModule("@acme/app/start.ts", "@acme/app"),
		name: "a module path of a package without an exports map that names no file",
		subject: "@acme/app/start.ts",
	},
];

const RESOLVED_REFERENCES = [
	{
		document: guide("```ts", 'import { makeRepository } from "@acme/lib/repository.ts";', "```"),
		name: "a code import of a name the module exports",
	},
	{ document: guide("```ts", 'import run from "@acme/tool/run.ts";', "```"), name: "a default import of a module with a default export" },
	{
		document: guide("```ts", 'import { anything } from "@acme/lib/forwarded.ts";', "```"),
		name: "any name imported from a module that re-exports another",
	},
	{ document: guide("Call `makeRepository` from `@acme/lib/repository.ts`."), name: "a name in prose that its module exports" },
	{
		document: markdown(
			"packages/lib/README.md",
			"# @acme/lib",
			"",
			"### API",
			"",
			"| Module | Exports |",
			"| --- | --- |",
			"| `repository.ts` | `makeRepository` |",
		),
		name: "a row of a package README's API table that names a module of the package",
	},
	{
		document: guide("```ts", 'import { main } from "@acme/app/main.ts";', "```"),
		name: "a module path of a package without an exports map that names a file",
	},
];

for (const { document, line, message, name, subject } of BROKEN_REFERENCES) {
	ruleStory.it(`docs/references reports ${name} at its line`, [repositoryHas(...MODULES, document)], function* ({ check }) {
		const findings = yield* check(docsReferences);

		expect(findings).toEqual([{ file: document.path, line, message, subject }]);
	});
}

for (const { document, name } of RESOLVED_REFERENCES) {
	ruleStory.it(`docs/references accepts ${name}`, [repositoryHas(...MODULES, document)], function* ({ check }) {
		expect(yield* check(docsReferences)).toEqual([]);
	});
}
