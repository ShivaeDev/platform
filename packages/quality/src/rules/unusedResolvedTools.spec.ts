import { expect } from "@effect/vitest";
import { importsResolvable } from "#rules/imports/resolvable.ts";
import { unusedCode } from "#rules/unusedCode.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const factory of ["createRequire", "createRequire as nodeRequire"]) {
	for (const rule of [unusedCode, importsResolvable]) {
		ruleStory.it(
			`${rule.id} recognises native ${factory} for an extensionless tool${rule.id === "code/unused" ? " and keeps an unrelated dependency reported" : " without a TypeScript declaration"}`,
			[
				repositoryHas(
					{
						content:
							'{"name":"app","type":"module","scripts":{"start":"node src/main.ts"},"dependencies":{"@fixture/tool":"*","@fixture/unused":"*"}}',
						path: "package.json",
					},
					{
						content: `import { ${factory} } from "node:module";
export const command = ${factory.includes(" as ") ? "nodeRequire" : "createRequire"}(import.meta.url).resolve("@fixture/tool/bin/cli");
const host = {resolve: (name: string) => name};
host.resolve("@fixture/unused");`,
						path: "src/main.ts",
					},
					{ content: '{"name":"@fixture/tool","exports":{"./bin/cli":"./bin/cli"}}', path: "node_modules/@fixture/tool/package.json" },
					{ content: "console.log('tool');", path: "node_modules/@fixture/tool/bin/cli" },
					{ content: '{"name":"@fixture/unused","main":"index.js"}', path: "node_modules/@fixture/unused/package.json" },
					{ content: "export const value = 1;", path: "node_modules/@fixture/unused/index.js" },
				),
			],
			function* ({ check }) {
				const findings = rule.id === "code/unused" ? yield* check(unusedCode) : yield* check(importsResolvable);
				expect(findings).toEqual(
					rule.id === "code/unused" ? [expect.objectContaining({ file: "package.json", subject: "dependencies:@fixture/unused" })] : [],
				);
			},
		);
	}
}
