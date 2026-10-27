import { expect } from "@effect/vitest";
import { workspace } from "#test/workspace.ts";

for (const { config, message, name } of [
	{ config: "null", message: "export a config object", name: "missing config object" },
	{ config: '{ packages: "packages/*" }', message: "packages must be directory paths", name: "invalid package selection" },
	{ config: '{ packages: ["packages/**"] }', message: "use a relative directory or parent/*", name: "unsupported package glob" },
]) {
	workspace.it(`check explains a ${name}`, [], function* ({ write, cli }) {
		yield* write(".changeset/changesets.config.ts", `export default ${config};\n`);
		const result = yield* cli("check");
		const exitCode = result.status;
		expect(exitCode).toBe(1);
		expect(result.stderr).toContain(message);
	});
}

workspace.it("check rejects duplicate workspace package names", [], function* ({ edit, cli }) {
	yield* edit("packages/dev/package.json", (text) => text.replace("@test/dev", "@test/core"));
	const result = yield* cli("check");
	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stderr).toContain("Workspace package names must be unique");
});

workspace.it("directory instructions remain outside the pending release", [], function* ({ write, cli }) {
	yield* write(".changeset/README.md", "# Author release notes here\n");
	expect((yield* cli("check")).status).toBe(0);
	expect((yield* cli("plan")).stdout.trim()).toBe("No pending releases.");
});
