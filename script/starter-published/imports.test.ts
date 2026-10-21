import { expect } from "vitest";
import { app } from "#starter-published/test-support/app.ts";
import { documentationFixture } from "#starter-published/test-support/documentationFixture.ts";
import { unpublishedContract } from "#starter-published/test-support/unpublishedContract.ts";

app.it(
	"checks named, aliased, type-only and namespace imports plus prose and module tables",
	[
		unpublishedContract,
		documentationFixture(
			[
				"```ts",
				'import { query as subscribe, type Streaming } from "@shivaedev/effect-contract/operation.ts";',
				'import type { Contract } from "@shivaedev/effect-contract/contract.ts";',
				'import * as keys from "@shivaedev/effect-contract/keys.ts";',
				"```",
				"Import `resumeSignal` from `@shivaedev/effect-contract/resume.ts`.",
				"| `resume.ts` | `resumeSignal` |",
			].join("\n"),
			"packages/effect-contract/README.md",
		),
	],
	function* ({ documentation, documentedEntries }) {
		expect(yield* documentation()).toBeUndefined();
		expect(yield* documentedEntries()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: "query", typeOnly: false }),
				expect.objectContaining({ name: "Streaming", typeOnly: true }),
				expect.objectContaining({ name: "Contract", typeOnly: true }),
				expect.objectContaining({ specifier: "@shivaedev/effect-contract/keys.ts" }),
				expect.objectContaining({ name: "resumeSignal", specifier: "@shivaedev/effect-contract/resume.ts" }),
			]),
		);
	},
);

for (const modules of [
	["relation/include.ts", "relation/includeMetadata.ts", "relation/PrismaMethods.ts"],
	["rejectionDecoding.ts", "client/rejection.ts"],
]) {
	app.it(
		`checks every comma-separated module in the ${modules[0]} table cell`,
		[
			unpublishedContract,
			documentationFixture(`| ${modules.map((path) => `\`${path}\``).join(", ")} | Supporting types |`, "packages/effect-contract/README.md"),
		],
		function* ({ documentation }) {
			const failure = yield* documentation();
			for (const path of modules) {
				expect(failure).toContain(`@shivaedev/effect-contract/${path}`);
			}
		},
	);
}

app.it(
	"checks relative modules in API child sections and excludes application example files",
	[
		unpublishedContract,
		documentationFixture(
			[
				"Save the application example as `notes.ts`.",
				"### API",
				"The wildcard module export also exposes `draft.ts` (`draft`), `refs.ts` (`fromRef`, `propertyRef`), `status.ts` (`statusOf`).",
				"#### Helpers",
				"The conversion helpers are in `shape.ts`.",
				"### Install",
				"Save your configuration as `app.ts`.",
			].join("\n"),
			"packages/effect-contract/README.md",
		),
	],
	function* ({ documentation }) {
		const failure = yield* documentation();
		for (const path of ["draft.ts", "refs.ts", "status.ts", "shape.ts"]) {
			expect(failure).toContain(`@shivaedev/effect-contract/${path}`);
		}
		for (const path of ["notes.ts", "app.ts"]) {
			expect(failure).not.toContain(`@shivaedev/effect-contract/${path}`);
		}
	},
);

app.it(
	"names the published package, missing stream export and missing server entry in drift failures",
	[
		unpublishedContract,
		documentationFixture(
			'```ts\nimport { query, stream as subscribe } from "@shivaedev/effect-contract/operation.ts";\n```\nImport `makeLiveServer` from `@shivaedev/effect-contract/makeLiveServer.ts`.',
			"packages/effect-contract/README.md",
		),
	],
	function* ({ documentation }) {
		const failure = yield* documentation();
		expect(failure).toContain("@shivaedev/effect-contract@0.1.0: import stream from @shivaedev/effect-contract/operation.ts");
		expect(failure).toContain("import makeLiveServer from @shivaedev/effect-contract/makeLiveServer.ts");
		expect(failure).toContain("packages/effect-contract/README.md");
		expect(failure).not.toContain("import query");
	},
);
