import { assertThat } from "@shivaedev/test-kits/quality/adapters/assertThat.ts";
import { docsReferences } from "#rules/docs/references.ts";
import { docsWorkspace, markdown, noModule } from "#test/docsRepository.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const OPEN_MANIFEST = {
	content: JSON.stringify({ exports: { "./*.ts": { "@shivaedev/source": "./src/*.ts" } }, name: "@acme/lib" }),
	path: "packages/lib/package.json",
};

for (const path of ["./internal/*", "./internal/secret.ts"]) {
	ruleStory.it(
		`docs/references reports a documented module under a null export at ${path} until the null entry is removed`,
		[
			repositoryHas(
				...docsWorkspace,
				{
					content: JSON.stringify({ exports: { "./*.ts": { "@shivaedev/source": "./src/*.ts" }, [path]: null }, name: "@acme/lib" }),
					path: "packages/lib/package.json",
				},
				markdown("docs/guide.md", "Call `hidden` from `@acme/lib/internal/secret.ts`."),
			),
		],
		function* ({ check, messages, writes }) {
			yield* check(docsReferences);
			yield* assertThat(yield* messages(), (actual) => actual.toEqual([noModule("@acme/lib/internal/secret.ts", "@acme/lib")]));

			yield* writes(OPEN_MANIFEST);

			yield* assertThat(yield* check(docsReferences), (actual) => actual.toEqual([]));
		},
	);
}
