import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test as it } from "node:test";
import { Schema } from "effect";
import { parse } from "yaml";
import { decodeManifest } from "#package-check/model.ts";

const Codecov = Schema.Struct({
	codecov: Schema.Struct({
		notify: Schema.Struct({ expectedUploads: Schema.Number }).pipe(Schema.encodeKeys({ expectedUploads: "after_n_builds" })),
	}),
	components: Schema.Struct({
		individual: Schema.Array(Schema.Struct({ name: Schema.String, paths: Schema.Array(Schema.String) })),
	}).pipe(Schema.encodeKeys({ individual: "individual_components" })),
}).pipe(Schema.encodeKeys({ components: "component_management" }));
const Workflow = Schema.Struct({
	jobs: Schema.Struct({ coverage: Schema.Struct({ strategy: Schema.Struct({ matrix: Schema.Struct({ shard: Schema.Array(Schema.Number) }) }) }) }),
});
const codecov = Schema.decodeUnknownSync(Codecov)(parse(readFileSync("codecov.yml", "utf8")));
const workflow = Schema.decodeUnknownSync(Workflow)(parse(readFileSync(".github/workflows/ci.yml", "utf8")));

it("Codecov waits for every coverage shard before it reports", () => {
	assert.equal(codecov.codecov.notify.expectedUploads, workflow.jobs.coverage.strategy.matrix.shard.length);
});

it("every published package has a Codecov component over its source", () => {
	const published = readdirSync("packages")
		.map((name) => ({ manifest: decodeManifest(readFileSync(`packages/${name}/package.json`, "utf8")), name }))
		.filter(({ manifest }) => manifest.private !== true)
		.map(({ manifest, name }) => ({ name: manifest.name, paths: [`packages/${name}/src/**`] }))
		.toSorted((left, right) => left.name.localeCompare(right.name));
	const components = codecov.components.individual
		.map(({ name, paths }) => ({ name, paths: [...paths] }))
		.toSorted((left, right) => left.name.localeCompare(right.name));
	assert.deepEqual(components, published);
});
