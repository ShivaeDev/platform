import { expect } from "@effect/vitest";
import { CORE, changeset } from "#test/fixture.ts";
import { pending, workspace } from "#test/workspace.ts";

const invalid = [
	{ message: "add YAML frontmatter", name: "missing-frontmatter", text: "### Added\n\n- Missing bumps.\n" },
	{ message: "one YAML package: bump mapping per line", name: "invalid-mapping", text: "---\n- core\n---\n### Added\n\n- Feature.\n" },
	{ message: "name at least one package", name: "empty-frontmatter", text: "---\n\n---\n### Added\n\n- Feature.\n" },
	{ message: "unknown package @test/missing", name: "unknown-package", text: changeset({ "@test/missing": "patch" }) },
	{ message: "explicit patch, minor or major", name: "invalid-bump", text: changeset({ [CORE]: "auto" }) },
	{ message: "is private; remove it", name: "private-package", text: changeset({ "@test/private": "patch" }) },
	{ message: "use minor for breaking changes", name: "pre-one-major", text: changeset({ [CORE]: "major" }) },
	{ message: "name each package once", name: "duplicate-package", text: `---\n"${CORE}": patch\n"${CORE}": minor\n---\n### Added\n\n- Feature.\n` },
	{ message: "use ### Added", name: "invalid-section", text: changeset({ [CORE]: "patch" }, "### Features\n\n- Feature.\n") },
	{ message: "under a ### section heading", name: "missing-section", text: changeset({ [CORE]: "patch" }, "- Feature.\n") },
	{ message: "write text after '- '", name: "empty-entry", text: changeset({ [CORE]: "patch" }, "### Fixed\n\n- \n") },
	{ message: "add at least one release-note entry", name: "empty-body", text: changeset({ [CORE]: "patch" }, "### Added\n") },
];
for (const { name, text, message } of invalid) {
	workspace.it(`check rejects ${name} with repair instructions`, [], function* ({ write, cli, exists }) {
		yield* write(`.changeset/${name}.md`, text);
		const result = yield* cli("check");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain(message);
		expect(yield* exists(`.changeset/${name}.md`)).toBe(true);
	});
}
workspace.it("plan and apply reject a pre-1.0 major without changing files", [pending({ [CORE]: "major" })], function* ({ cli, exists, read }) {
	for (const command of ["plan", "apply"]) {
		const result = yield* cli(command);
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("use minor for breaking changes");
	}
	expect(yield* exists(".changeset/feature.md")).toBe(true);
	expect(yield* exists(".changeset/release.json")).toBe(false);
	expect(JSON.parse(yield* read("packages/core/package.json")).version).toBe("0.2.3");
});
workspace.it("check names a missing base and the fetch command", [], function* ({ cli }) {
	const result = yield* cli("check", "missing-ref");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("git fetch origin main");
});
workspace.it("config selects package directories and refuses shell hooks", [], function* ({ write, change, cli }) {
	yield* write("modules/extra/package.json", '{"name":"@test/extra","version":"1.0.0"}');
	yield* write(".changeset/changesets.config.ts", 'export default { packages: ["modules/*"] };\n');
	yield* change("extra", { "@test/extra": "minor" });
	expect((yield* cli("plan")).stdout).toContain("@test/extra: 1.0.0 -> 1.1.0");
	yield* write(".changeset/changesets.config.ts", 'export default { hooks: ["echo hello"] };\n');
	const result = yield* cli("apply");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("hooks must be Effect functions, not shell strings");
});
