import { expect } from "@effect/vitest";
import { CORE, HISTORY } from "#test/fixture.ts";
import { workspace } from "#test/workspace.ts";

workspace.it("a declared rename releases the new name and preserves released history", [], function* ({ change, checkpoint, edit, cli, read }) {
	yield* change("rename", { "@test/renamed": "minor" }, "### Breaking\n\n- Rename `@test/core` to `@test/renamed`; use the new package name.\n");
	yield* checkpoint();
	for (const directory of ["core", "api", "private", "dev"]) {
		yield* edit(`packages/${directory}/package.json`, (text) => text.replaceAll(CORE, "@test/renamed"));
	}
	const pending = yield* cli("check");
	expect(pending.status, pending.stderr).toBe(0);
	const plan = yield* cli("plan", "--json");
	expect(plan.status, plan.stderr).toBe(0);
	expect(JSON.parse(plan.stdout).releases).toEqual([
		{ bump: "patch", directory: "packages/api", from: "0.5.0", name: "@test/api", to: "0.5.1" },
		{ bump: "patch", directory: "packages/optional", from: "1.0.0", name: "@test/optional", to: "1.0.1" },
		{ bump: "patch", directory: "packages/peer", from: "1.0.0", name: "@test/peer", to: "1.0.1" },
		{ bump: "minor", directory: "packages/core", from: "0.2.3", name: "@test/renamed", to: "0.3.0" },
	]);
	expect(yield* read("packages/core/CHANGELOG.md")).toBe(HISTORY);
	const applied = yield* cli("apply");
	expect(applied.status, applied.stderr).toBe(0);
	const released = yield* cli("check");
	expect(released.status, released.stderr).toBe(0);
	expect(yield* read("packages/core/CHANGELOG.md")).toContain(`\n${HISTORY.slice("# Changelog\n".length).trimStart()}`);
	yield* edit("packages/core/CHANGELOG.md", (text) => text.replace("Released history.", "Rewritten history."));
	const rewritten = yield* cli("check");
	const exitCode = rewritten.status;
	expect(exitCode).toBe(1);
	expect(rewritten.stderr).toContain("restore released history");
});

workspace.it("an undeclared removal explains how a remaining package declares it", [], function* ({ remove, cli }) {
	yield* remove("packages/dev/package.json");
	const result = yield* cli("check");
	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stderr).toContain("@test/dev");
	expect(result.stderr).toContain(".changeset/<name>.md");
	expect(result.stderr).toContain("### Breaking");
	expect(result.stderr).toContain("remaining package");
});

workspace.it("a declared removal leaves the retired package out of the release", [], function* ({ change, checkpoint, remove, cli, read }) {
	yield* change("retire", { [CORE]: "minor" }, "### Breaking\n\n- Remove `@test/optional`; use `@test/api` directly.\n");
	yield* checkpoint();
	yield* remove("packages/optional/package.json");
	const pending = yield* cli("check");
	expect(pending.status, pending.stderr).toBe(0);
	const plan = yield* cli("plan", "--json");
	expect(plan.status, plan.stderr).toBe(0);
	expect(JSON.parse(plan.stdout).releases.map((release: { name: string }) => release.name)).toEqual(["@test/api", CORE]);
	const applied = yield* cli("apply");
	expect(applied.status, applied.stderr).toBe(0);
	const released = yield* cli("check");
	expect(released.status, released.stderr).toBe(0);
	expect(yield* read("packages/optional/CHANGELOG.md")).toBe(HISTORY);
});

for (const [label, body] of [
	["a Changed entry", "### Changed\n\n- Remove `@test/dev`.\n"],
	["a different package name", "### Breaking\n\n- Remove `@test/dev-tools`.\n"],
] as const) {
	workspace.it(`a removal rejects ${label} as its declaration`, [], function* ({ change, remove, cli }) {
		yield* change("retire", { [CORE]: "minor" }, body);
		yield* remove("packages/dev/package.json");
		const result = yield* cli("check");
		const exitCode = result.status;
		expect(exitCode).toBe(1);
		expect(result.stderr).toContain("### Breaking");
	});
}

workspace.it("a rename requires the new package in declaration frontmatter", [], function* ({ change, edit, cli }) {
	yield* change("rename", { [CORE]: "minor" }, "### Breaking\n\n- Rename `@test/dev` to `@test/renamed`; use the new package name.\n");
	yield* edit("packages/dev/package.json", (text) => text.replace("@test/dev", "@test/renamed"));
	const result = yield* cli("check");
	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stderr).toContain("name the new package and its bump in frontmatter");
});
