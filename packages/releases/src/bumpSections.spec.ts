import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import { workspace } from "#test/workspace.ts";

for (const section of ["Breaking", "Added"]) {
	workspace.it(`a patch with ${section} notes fails every release command`, [], function* ({ change, cli }) {
		yield* change("too-small", { [CORE]: "patch" }, `### ${section}\n\n- New behavior.\n`);
		yield* change("larger", { [CORE]: "minor" });
		for (const command of ["check", "plan", "apply"]) {
			const result = yield* cli(command);
			expect(result.status).toBe(1);
			expect(result.stderr).toContain(`too-small.md: ${CORE} has a patch bump but its sections require at least minor`);
		}
	});
}

for (const { bump, body } of [
	{ body: "### Breaking\n\n- Migrate to the new behavior.\n", bump: "minor" },
	{ body: "### Fixed\n\n- Correct existing behavior.\n", bump: "patch" },
	{ body: "### Changed\n\n- Adjust existing behavior.\n\n### Fixed\n\n- Correct existing behavior.\n", bump: "patch" },
]) {
	workspace.it(`${bump} accepts ${body.split("\n")[0]} notes`, [], function* ({ change, cli }) {
		yield* change("valid", { [CORE]: bump }, body);
		expect((yield* cli("check")).status).toBe(0);
	});
}

workspace.it("every named package needs a sufficient bump", [], function* ({ change, cli }) {
	yield* change("shared", { [CORE]: "minor", "@test/api": "patch" });
	const result = yield* cli("check");
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("shared.md: @test/api has a patch bump but its sections require at least minor");
});
