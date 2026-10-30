import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { docsReferences } from "#rules/docs/references.ts";
import { docsWorkspace, markdown } from "#test/docsRepository.ts";

for (const path of ["./internal/*", "./internal/secret.ts"]) {
	ruleKit.it(
		`a null export at ${path} reports an unavailable documented module until the block is removed`,
		[
			repositoryHas(
				...docsWorkspace,
				{
					content: JSON.stringify({ exports: { "./*.ts": { source: "./src/*.ts" }, [path]: null }, name: "@acme/lib" }),
					path: "packages/lib/package.json",
				},
				markdown("docs/guide.md", "Call `hidden` from `@acme/lib/internal/secret.ts`."),
			),
		],
		function* ({ checks, writes }) {
			const blocked = yield* checks(docsReferences);

			expect(blocked.map((finding) => finding.message)).toEqual([
				'"@acme/lib/internal/secret.ts" names no module of @acme/lib. Use the path of a module its package.json "exports" maps.',
			]);

			yield* writes({
				content: JSON.stringify({ exports: { "./*.ts": { source: "./src/*.ts" } }, name: "@acme/lib" }),
				path: "packages/lib/package.json",
			});

			expect(yield* checks(docsReferences)).toEqual([]);
		},
	);
}
