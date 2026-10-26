import { expect } from "vitest";
import { app } from "#starter-published/test-support/app.ts";
import { documentationFixture } from "#starter-published/test-support/documentationFixture.ts";
import { unpublishedContract } from "#starter-published/test-support/unpublishedContract.ts";

app.it(
	"rejects an unpinned package imported by a framework guide",
	[unpublishedContract, documentationFixture('```ts\nimport { query } from "@shivaedev/unpinned/resource.ts";\n```')],
	function* ({ documentation }) {
		expect(yield* documentation()).toContain("docs/framework/add-a-feature.md: @shivaedev/unpinned/resource.ts needs a pinned published version");
	},
);

for (const [specifier, name] of [
	["@shivaedev/contract/operation.ts", "stream"],
	["@shivaedev/contract/makeLiveServer.ts", "makeLiveServer"],
] as const) {
	app.it(
		`rejects the unpublished ${name} API imported by a framework guide`,
		[unpublishedContract, documentationFixture(`\`\`\`ts\nimport { ${name} } from "${specifier}";\n\`\`\``)],
		function* ({ documentation }) {
			const failure = yield* documentation();
			expect(failure).toContain("Published documentation API check failed:");
			expect(failure).toContain(`import ${name} from ${specifier} (docs/framework/add-a-feature.md)`);
		},
	);
}
