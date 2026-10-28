import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { docsReferences } from "#rules/docs/references.ts";
import { docsWorkspace, markdown } from "#test/docsRepository.ts";

const readme = markdown(
	"packages/lib/README.md",
	"# @acme/lib",
	"",
	"```ts",
	'import { makeRepository, missingName } from "@acme/lib/repository.ts";',
	'import { hidden } from "@acme/lib/internal/secret.ts";',
	'import { Effect } from "effect";',
	'import { notes } from "./notes.ts";',
	"```",
	"",
	"Call `makeRepository` from `@acme/lib/repository.ts`, not `nothing` from `@acme/lib/repository.ts`, and skip `@acme/lib/gone.ts`.",
	"",
	"### API",
	"",
	"| Module | Exports |",
	"| --- | --- |",
	"| `repository.ts` | `makeRepository` |",
	"| `absent.ts` | `absent` |",
	"",
	"```js",
	'import { forwarded } from "@acme/lib/forwarded.ts";',
	'import { lost } from "@acme/lib/lost.ts";',
	"```",
);

ruleKit.it(
	"documented imports, module paths and API rows name modules a workspace package exports and names those modules export",
	[
		repositoryHas(...docsWorkspace, readme, {
			content: 'export { makeRepository } from "./repository.ts";\n',
			path: "packages/lib/src/forwarded.ts",
		}),
	],
	function* ({ checks, writes }) {
		const findings = yield* checks(docsReferences);
		expect(findings.map((finding) => [finding.line, finding.message])).toEqual([
			[
				4,
				'"@acme/lib/repository.ts" does not export missingName. Name an export of packages/lib/src/repository.ts, or the module that exports missingName.',
			],
			[5, '"@acme/lib/internal/secret.ts" is private: the package.json "exports" of @acme/lib blocks it. Document a module the package exports.'],
			[10, '"@acme/lib/gone.ts" names no module of @acme/lib. Use the path of a module its package.json "exports" maps.'],
			[
				10,
				'"@acme/lib/repository.ts" does not export nothing. Name an export of packages/lib/src/repository.ts, or the module that exports nothing.',
			],
			[17, '"@acme/lib/absent.ts" names no module of @acme/lib. Use the path of a module its package.json "exports" maps.'],
			[21, '"@acme/lib/lost.ts" names no module of @acme/lib. Use the path of a module its package.json "exports" maps.'],
		]);
		yield* writes(
			{
				content: "export function makeRepository(): number {\n\treturn 1;\n}\nexport const missingName = 2;\nexport const nothing = 0;\n",
				path: "packages/lib/src/repository.ts",
			},
			{ content: "export const absent = 1;\n", path: "packages/lib/src/absent.ts" },
			{ content: "export const gone = 1;\n", path: "packages/lib/src/gone.ts" },
			{ content: "export const lost = 1;\n", path: "packages/lib/src/lost.ts" },
		);
		expect((yield* checks(docsReferences)).map((finding) => finding.line)).toEqual([5]);
	},
);
