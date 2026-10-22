import { Schema } from "effect";
import { expect } from "vitest";
import { repository } from "#release/test-support/repository.ts";

const Versions = Schema.fromJsonString(Schema.Record(Schema.String, Schema.String));

repository.it("the repository hook aligns starter pins and both binaries with an applied release", [], function* ({ apply, check, read }) {
	expect(yield* check()).toBeUndefined();
	const plan = yield* apply();
	const pins = Schema.decodeUnknownSync(Versions)(yield* read("examples/starter/published-versions.json"));
	for (const name of ["@shivaedev/platform", "@shivaedev/work-fleet"]) {
		const release = plan.releases.find((entry) => entry.name === name);
		expect(release).toBeDefined();
		expect(pins[name]).toBe(release?.to);
	}
	expect(yield* read("packages/work-board/src/server/packageInfo.ts")).toBe('export const VERSION = "0.4.1";\n');
	expect(yield* read("packages/work-fleet/src/packageInfo.ts")).toBe('export const VERSION = "0.3.1";\n');
	expect(yield* check()).toBeUndefined();
});

repository.it("the pin check rejects a starter pin that differs from its workspace package", [], function* ({ check, read, write }) {
	const original = yield* read("examples/starter/published-versions.json");
	yield* write("examples/starter/published-versions.json", original.replace("0.15.0", "0.14.0"));
	expect(yield* check()).toContain("@shivaedev/platform@0.14.0 must pin the current release 0.15.0");
	yield* write("examples/starter/published-versions.json", original);
	expect(yield* check()).toBeUndefined();
});

repository.it("the pin check names a drifted pnpm pin and its repair", [], function* ({ check, read, write }) {
	const original = yield* read("examples/starter/package.json");
	yield* write("examples/starter/package.json", original.replace("pnpm@12.13.0", "pnpm@12.8.1"));
	expect(yield* check()).toBe(
		"examples/starter/package.json: pnpm pin 12.8.1 differs from root package.json pnpm version 12.13.0. Run pnpm changesets apply for a release, or set packageManager to pnpm@12.13.0 in examples/starter/package.json.",
	);
});

repository.it("the pin check accepts the root pnpm version without its integrity suffix", [], function* ({ check }) {
	expect(yield* check()).toBeUndefined();
});

for (const kind of ["dependencies", "optionalDependencies", "peerDependencies"]) {
	repository.it(`the pin check rejects a missing framework pin from ${kind}`, [], function* ({ check, write }) {
		yield* write("examples/starter/published-versions.json", '{"@shivaedev/work-fleet":"0.3.0"}\n');
		yield* write(
			"packages/work-fleet/package.json",
			JSON.stringify({ [kind]: { "@shivaedev/platform": "workspace:*" }, name: "@shivaedev/work-fleet", version: "0.3.0" }),
		);
		expect(yield* check()).toContain("depends on @shivaedev/platform@0.15.0, but its pin is missing");
	});
}

repository.it("the release check rejects an old fragment and accepts it after migration", [], function* ({ check, write, remove }) {
	yield* write("packages/platform/changes/open-pr.md", "### Fixed\n\n- A pending fix.\n");
	const rejected = yield* check();
	expect(rejected).toContain("packages/platform/changes/open-pr.md");
	expect(rejected).toContain(".changeset/<short-name>.md");
	yield* remove("packages/platform/changes/open-pr.md");
	yield* write(".changeset/open-pr.md", '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- A pending fix.\n');
	expect(yield* check()).toBeUndefined();
});

repository.it(
	"a copied release repository commits relative links and keeps writes inside the copy",
	[],
	function* ({ copy, gitCopy, read, readCopy, writeCopy }) {
		yield* copy();
		expect(yield* gitCopy("show", "HEAD:CLAUDE.md")).toBe("AGENTS.md");
		expect(yield* gitCopy("show", "HEAD:.claude/skills/package-docs")).toBe("../../.agents/skills/package-docs");
		yield* writeCopy("CLAUDE.md", "Copied instructions.\n");
		yield* writeCopy(".claude/skills/package-docs/SKILL.md", "Copied documentation.\n");
		expect(yield* readCopy("AGENTS.md")).toBe("Copied instructions.\n");
		expect(yield* read("AGENTS.md")).toBe("Repository instructions.\n");
		expect(yield* read(".agents/skills/package-docs/SKILL.md")).toBe("Package documentation.\n");
	},
);
