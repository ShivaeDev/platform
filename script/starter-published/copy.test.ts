import assert from "node:assert/strict";
import { existsSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { test as it } from "node:test";
import { Schema } from "effect";
import { decodeManifest, Versions } from "#package-check/model.ts";
import { copiedApp } from "#starter-published/test-support/copiedApp.ts";

it("copies the starter's quality gate as a standalone app without a Quality config or baseline", async () => {
	const fixture = await copiedApp();
	const { consumer, versions } = fixture;
	try {
		assert.equal(readFileSync(join(consumer, "biome.json"), "utf8"), '{\n\t"extends": ["@shivaedev/quality/biome"],\n\t"root": true\n}\n');
		const manifest = decodeManifest(readFileSync(join(consumer, "package.json"), "utf8"));
		const { scripts } = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ scripts: Versions })))(
			readFileSync(join(consumer, "package.json"), "utf8"),
		);
		assert.equal(scripts.lint, "quality lint");
		assert.equal(scripts.format, "quality fix");
		assert.equal(manifest.devDependencies?.["@shivaedev/quality"], versions["@shivaedev/quality"]);
		assert.equal(readlinkSync(join(consumer, "CLAUDE.md")), "AGENTS.md");
		assert.ok(!existsSync(join(consumer, "quality.config.ts")));
		assert.ok(!existsSync(join(consumer, "quality/baseline.jsonl")));
	} finally {
		fixture.remove();
	}
});
