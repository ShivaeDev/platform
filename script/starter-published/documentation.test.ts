import assert from "node:assert/strict";
import { test as it } from "node:test";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { documentationFixture } from "#starter-published/test-support/documentationFixture.ts";
import { checkDocumentation, readDocumentation } from "./documentation.ts";

const versions = { "@shivaedev/effect-contract": "0.1.0" };

it("rejects an unpinned package imported by a framework guide", async () => {
	const fixture = documentationFixture("@shivaedev/unpinned/resource.ts");
	try {
		await assert.rejects(
			Effect.runPromise(readDocumentation(fixture.root, versions).pipe(Effect.provide(NodeFileSystem.layer))),
			/docs\/framework\/add-a-feature.md: @shivaedev\/unpinned\/resource.ts needs a pinned published version/u,
		);
	} finally {
		fixture.remove();
	}
});

it("rejects unpublished names and entry points imported by a framework guide", async () => {
	for (const [specifier, name] of [
		["@shivaedev/effect-contract/operation.ts", "stream"],
		["@shivaedev/effect-contract/makeLiveServer.ts", "makeLiveServer"],
	] as const) {
		const fixture = documentationFixture(specifier, name);
		try {
			const program = Effect.gen(function* () {
				const entries = yield* readDocumentation(fixture.root, versions);
				yield* checkDocumentation(fixture.root, entries, versions);
			});
			await assert.rejects(
				Effect.runPromise(program.pipe(Effect.provide(NodeFileSystem.layer))),
				(error: unknown) =>
					error instanceof Error
					&& error.message.includes("Published documentation API check failed:")
					&& error.message.includes(`import ${name} from ${specifier} (docs/framework/add-a-feature.md)`),
			);
		} finally {
			fixture.remove();
		}
	}
});
