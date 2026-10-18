import { expect } from "@effect/vitest";
import { Clock } from "effect";
import { CORE, HISTORY } from "#test/fixture.ts";
import { guardedCommits, pending, workspace } from "#test/workspace.ts";

workspace.it(
	"apply writes versions, UTC notes and the exact consumed inputs while preserving history",
	[pending()],
	function* ({ change, cli, read, exists, checkpoint }) {
		yield* change(
			"z-last",
			{ [CORE]: "patch", "@test/api": "patch" },
			"### Fixed\n\n- A fix for both packages.\n\n### Changed\n\n- Changed behavior.\n",
		);
		yield* change("a-first", { [CORE]: "patch" }, "### Breaking\n\n- Breaking behavior.\n\n### Added\n\n- First alphabetically.\n");
		yield* checkpoint();
		const date = new Date(yield* Clock.currentTimeMillis).toISOString().slice(0, 10);
		const applied = yield* cli("apply");
		expect(applied.status).toBe(0);
		const notes = yield* read("packages/core/CHANGELOG.md");
		expect(notes).toBe(
			`# Changelog\n\n## 0.3.0 - ${date}\n\n### Added\n\n- First alphabetically.\n- A new feature.\n\n### Changed\n\n- Changed behavior.\n\n### Fixed\n\n- A fix for both packages.\n\n### Breaking\n\n- Breaking behavior.\n\n${HISTORY.slice("# Changelog\n\n".length)}`,
		);
		expect(yield* read("packages/api/CHANGELOG.md")).toContain("- A fix for both packages.");
		expect(yield* read("packages/optional/CHANGELOG.md")).toContain("Release with updated workspace dependencies.");
		expect(JSON.parse(yield* read("packages/optional/package.json")).optionalDependencies["@test/api"]).toBe("^0.5.1");
		expect(JSON.parse(yield* read("packages/peer/package.json")).peerDependencies["@test/optional"]).toBe("workspace:1.0.1");
		expect(JSON.parse(yield* read("packages/api/package.json")).dependencies[CORE]).toBe("workspace:*");
		expect(yield* exists(".changeset/feature.md")).toBe(false);
		expect(yield* exists(".changeset/z-last.md")).toBe(false);
		const manifest = JSON.parse(yield* read(".changeset/release.json"));
		expect(manifest.date).toBe(date);
		expect(manifest.plan.changesets.map((source: { name: string }) => source.name)).toEqual(["a-first.md", "feature.md", "z-last.md"]);
		expect((yield* cli("check")).status).toBe(0);
		yield* change("later", { [CORE]: "patch" });
		expect((yield* cli("check", "main")).status).toBe(0);
		yield* checkpoint("squashed");
		expect((yield* cli("check", "main")).status).toBe(0);
	},
);

workspace.it(
	"committed typed hooks stay portable under a global commit guard and update repository pins",
	[pending(), guardedCommits],
	function* ({ write, cli, read, checkpoint, exists }) {
		yield* write(".changeset/changesets.config.ts", 'import hook from "./repositoryHook.ts";\nexport default { hooks: [hook] };\n');
		yield* write(
			".changeset/repositoryHook.ts",
			'import { Effect, FileSystem } from "effect";\nexport default ({ root, plan }) => Effect.gen(function* () { const fs = yield* FileSystem.FileSystem; yield* fs.writeFileString(root + "/published-versions.json", JSON.stringify(Object.fromEntries(plan.releases.map(release => [release.name, release.to])))); });\n',
		);
		yield* checkpoint();
		expect(yield* exists(".git/global-hook-ran")).toBe(false);
		expect((yield* cli("apply")).status).toBe(0);
		expect(JSON.parse(yield* read("published-versions.json"))[CORE]).toBe("0.3.0");
		expect((yield* cli("check")).status).toBe(0);
	},
);
