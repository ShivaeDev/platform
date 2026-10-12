import assert from "node:assert/strict";
import process from "node:process";
import { test as it } from "node:test";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { unpublishedContract } from "#starter-published/test-support/unpublishedContract.ts";
import { registryDependencies } from "./copy.ts";
import { importProblems, readDocumentation } from "./documentation.ts";
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

it("covers every module in table cells with comma-separated paths", () => {
	for (const [owner, modules] of [
		["effect-prisma", ["relation/include.ts", "relation/include-metadata.ts", "relation/prisma-methods.ts"]],
		["effect-trpc", ["rejectionDecoding.ts", "client/rejection.ts"]],
	] as const) {
		const markdown = `| ${modules.map((path) => `\`${path}\``).join(", ")} | Supporting types |`;
		assert.deepEqual(
			documentedImports(markdown, "README.md", `@shivaedev/${owner}`).map((entry) => entry.specifier),
			modules.map((path) => `@shivaedev/${owner}/${path}`),
		);
	}
});

it("covers relative module paths in API prose, including child sections, and excludes application example files", () => {
	const markdown = [
		"Save the application example as `notes.ts`.",
		"### API",
		"The wildcard module export also exposes `draft.ts` (`draft`), `refs.ts` (`fromRef`, `propertyRef`), `status.ts` (`statusOf`).",
		"#### Helpers",
		"The conversion helpers are in `shape.ts`.",
		"### Install",
		"Save your configuration as `app.ts`.",
	].join("\n");
	assert.deepEqual(
		documentedImports(markdown, "README.md", "@shivaedev/effect-form").map((entry) => entry.specifier),
		["draft.ts", "refs.ts", "status.ts", "shape.ts"].map((path) => `@shivaedev/effect-form/${path}`),
	);
});

it("includes the supporting modules documented by the framework READMEs", async () => {
	const entries = await Effect.runPromise(
		readDocumentation(process.cwd(), {
			"@shivaedev/effect-form": "0.2.1",
			"@shivaedev/effect-prisma": "0.8.0",
			"@shivaedev/effect-trpc": "0.6.1",
		}).pipe(Effect.provide(NodeFileSystem.layer)),
	);
	for (const specifier of [
		"@shivaedev/effect-prisma/relation/include.ts",
		"@shivaedev/effect-prisma/relation/include-metadata.ts",
		"@shivaedev/effect-prisma/relation/prisma-methods.ts",
		"@shivaedev/effect-trpc/rejectionDecoding.ts",
		"@shivaedev/effect-form/draft.ts",
		"@shivaedev/effect-form/refs.ts",
		"@shivaedev/effect-form/status.ts",
	]) {
		assert.ok(
			entries.some((entry) => entry.specifier === specifier),
			`Missing documented entry point: ${specifier}`,
		);
	}
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
