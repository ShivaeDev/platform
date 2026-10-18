import { fileURLToPath } from "node:url";
import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import { pending, workspace } from "#test/workspace.ts";

workspace.it("the platform hook aligns existing starter pins and both CLI constants", [pending()], function* ({ write, checkpoint, cli, read }) {
	for (const name of ["work-board", "work-fleet"]) {
		yield* write(
			`packages/${name}/package.json`,
			JSON.stringify({ dependencies: { [CORE]: "workspace:*" }, name: `@shivaedev/${name}`, version: "0.1.0" }),
		);
	}
	yield* write("packages/work-board/src/server/packageInfo.ts", 'export const NAME = "work-board";\nexport const VERSION = "0.1.0";\n');
	yield* write("packages/work-fleet/src/packageInfo.ts", 'export const VERSION = "0.1.0";\n');
	yield* write("examples/starter/published-versions.json", JSON.stringify({ [CORE]: "0.2.3", "@other/unreleased": "1.0.0" }));
	const hook = fileURLToPath(new URL("../../../script/release/platformHook.ts", import.meta.url));
	yield* write(
		".changeset/changesets.config.ts",
		`import { releasePlatformHook } from ${JSON.stringify(hook)};\nexport default { hooks: [releasePlatformHook] };\n`,
	);
	yield* checkpoint();
	const result = yield* cli("apply");
	expect(result.status, result.stderr).toBe(0);
	expect(JSON.parse(yield* read("examples/starter/published-versions.json"))).toEqual({ [CORE]: "0.3.0", "@other/unreleased": "1.0.0" });
	expect(yield* read("packages/work-board/src/server/packageInfo.ts")).toContain('export const VERSION = "0.1.1";');
	expect(yield* read("packages/work-fleet/src/packageInfo.ts")).toContain('export const VERSION = "0.1.1";');
	expect((yield* cli("check")).status).toBe(0);
});
