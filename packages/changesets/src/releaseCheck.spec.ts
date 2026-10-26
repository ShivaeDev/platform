import { expect } from "@effect/vitest";
import { CORE, HISTORY } from "#test/fixture.ts";
import { pending, released, workspace } from "#test/workspace.ts";

workspace.it("check accepts a release derived from deleted base changesets", [pending(), released], function* ({ cli }) {
	const result = yield* cli("check");
	expect(result.status, result.stderr).toBe(0);
});

for (const note of ["", "- A different feature.\n"]) {
	workspace.it(
		`check rejects a consumed note ${note === "" ? "dropped" : "altered"} in the changelog`,
		[pending(), released],
		function* ({ edit, cli }) {
			yield* edit("packages/core/CHANGELOG.md", (text) => text.replace("- A new feature.\n", note));
			const result = yield* cli("check");
			expect(result.status).toBe(1);
			expect(result.stderr).toContain("release notes differ from changesets apply");
		},
	);
}

workspace.it("check rejects a consumed changeset left pending", [pending(), released], function* ({ change, cli }) {
	yield* change("feature", { [CORE]: "minor" });
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("run changesets apply");
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

for (const [file, to] of [
	["packages/dev/package.json", "1.0.1"],
	["packages/core/package.json", "0.4.0"],
	["packages/peer/package.json", "1.0.0"],
] as const) {
	workspace.it(`check rejects a version outside the computed plan in ${file}`, [pending(), released], function* ({ edit, cli }) {
		yield* edit(file, (text) => JSON.stringify({ ...JSON.parse(text), version: to }));
		const result = yield* cli("check");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("version differs from the release plan");
	});
}

workspace.it("check rejects an invalid release heading date", [pending(), released], function* ({ edit, cli }) {
	yield* edit("packages/api/CHANGELOG.md", (text) => text.replace(/^(?<heading>## [^ ]+ - )[^\n]+/mu, "$<heading>2026-02-30"));
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("valid UTC YYYY-MM-DD release date");
});

workspace.it("check rejects mismatched release heading dates", [pending(), released], function* ({ edit, cli }) {
	yield* edit("packages/core/CHANGELOG.md", (text) => text.replace(/^(?<heading>## [^ ]+ - )[^\n]+/mu, "$<heading>2026-01-02"));
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("same UTC release date");
});

workspace.it("check rejects removing a package's released history", [], function* ({ remove, cli }) {
	yield* remove("packages/core/package.json");
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("restore the package and its released history");
});
