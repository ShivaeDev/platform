import { Schema } from "effect";
import { expect } from "vitest";
import { ReleasePlan } from "@shivaedev/changesets/model.ts";
import { pending, platform } from "#release/test-support/platform.ts";

const Versions = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));

platform.it("the repository config applies a release with aligned starter pins and binary versions", [pending], function* ({ cli, check, read }) {
	const pins = Schema.decodeUnknownSync(Versions)(yield* read("examples/starter/published-versions.json"));
	const paths = {
		"@shivaedev/work-board": "packages/work-board/src/server/packageInfo.ts",
		"@shivaedev/work-fleet": "packages/work-fleet/src/packageInfo.ts",
	};
	const board = yield* read(paths["@shivaedev/work-board"]);
	const fleet = yield* read(paths["@shivaedev/work-fleet"]);
	const planned = yield* cli("plan", "--json");
	expect(planned.status, planned.stderr).toBe(0);
	const plan = Schema.decodeUnknownSync(Schema.fromJsonString(ReleasePlan))(planned.stdout);
	const applied = yield* cli("apply");
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
		expect(yield* read(path)).toContain(`export const VERSION = "${release.to}";`);
	}
	const checked = yield* check();
	expect(checked.status, checked.stderr).toBe(0);
});
