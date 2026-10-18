import { expect } from "@effect/vitest";
import { Schema } from "effect";
import { ReleaseManifest } from "#model.ts";
import { CORE, HISTORY } from "#test/fixture.ts";
import { manifestFaults } from "#test/manifestFaults.ts";
import { pending, released, workspace } from "#test/workspace.ts";

const decode = Schema.decodeUnknownSync(Schema.fromJsonString(ReleaseManifest));
const MANIFEST_PATH = ".changeset/release.json";

for (const { damage, message, name } of manifestFaults) {
	workspace.it(`check rejects a ${name} in the release manifest`, [pending(), released], function* ({ edit, cli }) {
		yield* edit(MANIFEST_PATH, (text) => JSON.stringify(damage(decode(text))));
		const result = yield* cli("check");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain(message);
	});
}

workspace.it("check rejects a consumed changeset left pending", [pending(), released], function* ({ change, cli }) {
	yield* change("feature", { [CORE]: "minor" });
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("consumed changesets must be deleted");
});

for (const file of ["packages/core/CHANGELOG.md", "packages/dev/CHANGELOG.md"]) {
	workspace.it(`check protects released history in ${file}`, [pending(), released], function* ({ edit, cli }) {
		yield* edit(file, (text) => text.replace("Released history.", "Edited history."));
		const result = yield* cli("check");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("restore released history");
	});
}

workspace.it("check refuses a released package without its generated notes", [pending(), released], function* ({ write, cli }) {
	yield* write("packages/core/CHANGELOG.md", HISTORY);
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("release notes differ from changesets apply");
});

workspace.it("check refuses versions outside the recorded plan", [pending(), released], function* ({ edit, cli }) {
	yield* edit("packages/dev/package.json", (text) => text.replace("1.0.0", "1.0.1"));
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("version differs from the release plan");
});

workspace.it("a changeset added and consumed between base and head survives squash validation", [], function* ({ change, cli, checkpoint }) {
	yield* change("branch-only", { [CORE]: "patch" });
	expect((yield* cli("apply")).status).toBe(0);
	yield* checkpoint("released-head");
	expect((yield* cli("check", "main")).status).toBe(0);
});
