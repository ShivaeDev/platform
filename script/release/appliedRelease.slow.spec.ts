import { Schema } from "effect";
import { expect } from "vitest";
import { ReleasePlan } from "@shivaedev/changesets/model.ts";
import { pending, platform } from "#release/test-support/platform.ts";

const Inventory = Schema.Struct({ packages: Schema.Array(Schema.Struct({ name: Schema.String, version: Schema.String })) });
const Consumers = Schema.Struct({ timings: Schema.Array(Schema.Struct({ name: Schema.String })) });
const Versions = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));

platform.it(
	"an applied repository release builds and passes packed consumers with aligned pins and binaries",
	[pending],
	function* ({ run, read }) {
		const pins = Schema.decodeUnknownSync(Versions)(yield* read("examples/starter/published-versions.json"));
		const paths = {
			"@shivaedev/work-board": "packages/work-board/src/server/packageInfo.ts",
			"@shivaedev/work-fleet": "packages/work-fleet/src/packageInfo.ts",
		};
		const board = yield* read(paths["@shivaedev/work-board"]);
		const fleet = yield* read(paths["@shivaedev/work-fleet"]);
		const planned = yield* run("changesets", "plan", "--json");
		expect(planned.status, planned.stderr).toBe(0);
		const plan = Schema.decodeUnknownSync(Schema.fromJsonString(ReleasePlan))(planned.stdout);
		const applied = yield* run("changesets", "apply");
		expect(applied.status, applied.stderr).toBe(0);
		const updatedPins = Schema.decodeUnknownSync(Versions)(yield* read("examples/starter/published-versions.json"));
		for (const [name, version] of Object.entries(pins)) {
			const release = plan.releases.find((entry) => entry.name === name);
			expect(updatedPins[name]).toBe(release?.to ?? version);
		}
		expect(updatedPins["@shivaedev/platform"]).not.toBe(pins["@shivaedev/platform"]);
		for (const [name, path] of Object.entries(paths)) {
			const release = plan.releases.find((entry) => entry.name === name);
			if (release === undefined) {
				throw new Error(`The release plan must include ${name}.`);
			}
			const before = name === "@shivaedev/work-board" ? board : fleet;
			expect(yield* read(path)).toBe(before.replace(`export const VERSION = "${release.from}";`, `export const VERSION = "${release.to}";`));
		}
		const checked = yield* run("changelog:check");
		expect(checked.status, checked.stderr).toBe(0);
		const built = yield* run("build");
		expect(built.status, built.stderr).toBe(0);
		const prepared = yield* run("test:package", "--prepare", ".ci/release-packages");
		expect(prepared.status, prepared.stderr).toBe(0);
		const inventory = Schema.decodeUnknownSync(Schema.fromJsonString(Inventory))(yield* read(".ci/release-packages/manifest.json"));
		expect(inventory.packages).toEqual(expect.arrayContaining(plan.releases.map((release) => ({ name: release.name, version: release.to }))));
		const packed = yield* run("test:package", "--archives", ".ci/release-packages", "--report", ".ci/release-consumers.json");
		expect(packed.status, `${packed.stdout}\n${packed.stderr}`).toBe(0);
		const report = Schema.decodeUnknownSync(Schema.fromJsonString(Consumers))(yield* read(".ci/release-consumers.json"));
		expect(report.timings).toEqual(expect.arrayContaining(plan.releases.map((release) => ({ name: release.name }))));
	},
	20 * 60_000,
);
