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

repository.it("applying a release repairs the pnpm pin alongside starter package pins", [], function* ({ apply, check, read, write }) {
	const original = yield* read("examples/starter/package.json");
	yield* write("examples/starter/package.json", original.replace("pnpm@12.13.0", "pnpm@12.8.1"));
	yield* apply();
	const manifest = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)))(
		yield* read("examples/starter/package.json"),
	);
	expect(manifest).toEqual({ name: "@shivaedev/starter", packageManager: "pnpm@12.13.0", private: true, version: "0.0.0" });
	const pins = Schema.decodeUnknownSync(Versions)(yield* read("examples/starter/published-versions.json"));
	expect(pins["@shivaedev/platform"]).toBe("0.15.1");
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

repository.it("the catalog check reports every shared entry that differs from the root", [], function* ({ check, read, write }) {
	const original = yield* read("examples/starter/pnpm-workspace.copy.yaml");
	yield* write("examples/starter/pnpm-workspace.copy.yaml", original.replace("1.57.0", "1.55.0").replace("24.19.2", "24.19.1"));
	expect(yield* check()).toBe(
		"examples/starter/pnpm-workspace.copy.yaml: catalog entry lucide-react pins 1.55.0, but root pnpm-workspace.yaml pins 1.57.0.\nexamples/starter/pnpm-workspace.copy.yaml: catalog entry @types/node pins 24.19.1, but root pnpm-workspace.yaml pins 24.19.2.\nRun pnpm changesets apply for a release, or align these starter catalog entries with the root catalog.",
	);
});

repository.it("the catalog check accepts shared default pins and leaves unshared entries independent", [], function* ({ check }) {
	expect(yield* check()).toBeUndefined();
});

repository.it("applying a release aligns shared catalog entries alongside package and pnpm pins", [], function* ({ apply, check, read, write }) {
	const catalog = yield* read("examples/starter/pnpm-workspace.copy.yaml");
	const rootCatalog = yield* read("pnpm-workspace.yaml");
	const manifest = yield* read("examples/starter/package.json");
	yield* write("examples/starter/pnpm-workspace.copy.yaml", catalog.replace("1.57.0", "1.55.0").replace("24.19.2", "24.19.1"));
	yield* write("examples/starter/package.json", manifest.replace("pnpm@12.13.0", "pnpm@12.8.1"));
	yield* apply();
	expect(yield* read("examples/starter/pnpm-workspace.copy.yaml")).toBe(catalog);
	expect(yield* read("pnpm-workspace.yaml")).toBe(rootCatalog);
	expect(yield* read("examples/starter/package.json")).toBe(manifest);
	expect(yield* read("examples/starter/published-versions.json")).toContain('"@shivaedev/platform": "0.15.1"');
	expect(yield* check()).toBeUndefined();
});

repository.it("the release check rejects a tampered generated starter-pins input", [], function* ({ write, git, plan, read, apply, check }) {
	yield* write(".changeset/pending.md", '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- Pending behavior.\n');
	yield* git("add", ".changeset/pending.md");
	yield* git("commit", "-m", "Pending starter pin release");
	yield* plan();
	const generated = yield* read(".changeset/release-starter-pins.md");
	yield* write(".changeset/release-starter-pins.md", generated.replace("latest released starter dependencies", "unreviewed starter dependencies"));
	yield* apply();
	expect(yield* check()).toContain("@shivaedev/create-app: release notes differ from changesets apply");
});

repository.it("the release check rejects an additional input created and consumed inside the release diff", [], function* ({ write, apply, check }) {
	yield* write(".changeset/extra.md", '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- An extra unrecorded note.\n');
	yield* apply();
	expect(yield* check()).toContain("@shivaedev/platform: release notes differ from changesets apply");
});
