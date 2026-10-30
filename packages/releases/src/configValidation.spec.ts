import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import { changeset, configured, directoryInstructions, extraModule, renamed } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

for (const { config, description, refusal } of [
	{ config: "null", description: "exports null", refusal: ".changeset/changesets.config.ts: export a config object with defineConfig." },
	{
		config: '{ packages: "packages/*" }',
		description: "selects packages with a string",
		refusal: ".changeset/changesets.config.ts: packages must be directory paths or parent/* patterns.",
	},
	{
		config: '{ packages: ["packages/**"] }',
		description: "selects packages with the glob packages/**",
		refusal: "Invalid package pattern packages/**; use a relative directory or parent/*.",
	},
	{
		config: '{ hooks: ["echo hello"] }',
		description: "configures a shell string as a hook",
		refusal: ".changeset/changesets.config.ts: hooks must be Effect functions, not shell strings.",
	},
]) {
	workspace.it(
		`check refuses a config that ${description} and explains the expected shape`,
		[configured(description, `export default ${config};\n`)],
		function* ({ check }) {
			expect(yield* check()).toBe(`refused: ${refusal}`);
		},
	);
}

workspace.it(
	"plan finds @test/extra in the modules/* folder the config selects",
	[extraModule, configured('selects "modules/*"', 'export default { packages: ["modules/*"] };\n'), changeset("extra", { "@test/extra": "minor" })],
	function* ({ plan }) {
		expect(yield* plan()).toEqual(["@test/extra: 1.0.0 -> 1.1.0 (minor)"]);
	},
);

workspace.it(`check refuses two workspace packages named ${CORE}`, [renamed("@test/dev", CORE)], function* ({ check }) {
	expect(yield* check()).toBe("refused: Workspace package names must be unique; fix package.json names.");
});

workspace.it("plan reads .changeset/README.md as instructions, not as a changeset", [directoryInstructions], function* ({ plan }) {
	expect(yield* plan()).toEqual(["No pending releases."]);
});
