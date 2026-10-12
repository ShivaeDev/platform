import assert from "node:assert/strict";
import { test as it } from "node:test";
import { unpublishedContract } from "#starter-published/test-support/unpublishedContract.ts";
import { registryDependencies } from "./copy.ts";
import { importProblems } from "./documentation.ts";
import { documentedImports } from "./imports.ts";

it("covers named, aliased, type-only and namespace imports plus prose and module tables", () => {
	const markdown = [
		"```ts",
		'import { query, stream as subscribe, type Streaming } from "@shivaedev/effect-contract/operation.ts";',
		'import type { Contract } from "@shivaedev/effect-contract/contract.ts";',
		'import * as keys from "@shivaedev/effect-contract/keys.ts";',
		"```",
		"Import `makeLiveServer` from `@shivaedev/effect-contract/makeLiveServer.ts`.",
		"| `resume.ts` | `resumeSignal` |",
	].join("\n");
	const entries = documentedImports(markdown, "README.md", "@shivaedev/effect-contract");
	assert.ok(entries.some((entry) => entry.name === "stream"));
	assert.ok(entries.some((entry) => entry.name === "Streaming" && entry.typeOnly));
	assert.ok(entries.some((entry) => entry.name === "Contract" && entry.typeOnly));
	assert.ok(entries.some((entry) => entry.name === "makeLiveServer"));
	assert.ok(entries.some((entry) => entry.specifier.endsWith("/keys.ts")));
	assert.ok(entries.some((entry) => entry.specifier.endsWith("/resume.ts")));
});

it("names the published package, missing stream export and missing server entry in drift failures", () => {
	const fixture = unpublishedContract();
	try {
		const problems = importProblems(fixture.path, fixture.entries, { "@shivaedev/effect-contract": "0.1.0" });
		assert.ok(
			problems.some((problem) => problem.includes("@shivaedev/effect-contract@0.1.0: import stream from @shivaedev/effect-contract/operation.ts")),
		);
		assert.ok(problems.some((problem) => problem.includes("import makeLiveServer from @shivaedev/effect-contract/makeLiveServer.ts")));
		assert.ok(problems.every((problem) => problem.includes("packages/effect-contract/README.md")));
		assert.ok(!problems.some((problem) => problem.includes("import query")));
	} finally {
		fixture.remove();
	}
});

it("copies workspace dependencies to named registry versions and refuses missing or floating versions", () => {
	assert.deepEqual(
		registryDependencies({ "@shivaedev/effect-contract": "workspace:*", effect: "catalog:" }, { "@shivaedev/effect-contract": "0.4.1" }),
		{
			"@shivaedev/effect-contract": "0.4.1",
			effect: "catalog:",
		},
	);
	for (const versions of [{}, { "@shivaedev/effect-contract": "latest" }, { "@shivaedev/effect-contract": "^0.4.1" }]) {
		assert.throws(
			() => registryDependencies({ "@shivaedev/effect-contract": "workspace:*" }, versions),
			/effect-contract: name an exact published version/u,
		);
	}
});
