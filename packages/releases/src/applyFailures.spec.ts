import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import { pending, workspace } from "#test/workspace.ts";

workspace.it("unsupported workspace dependency ranges fail before collection writes", [pending()], function* ({ edit, cli, exists, read }) {
	yield* edit("packages/api/package.json", (text) => text.replace("workspace:*", ">=0.2.0 <1"));
	const result = yield* cli("apply");
	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stderr).toContain("before applying a release");
	expect(yield* exists(".changeset/feature.md")).toBe(true);
	expect(JSON.parse(yield* read("packages/core/package.json")).version).toBe("0.2.3");
});

workspace.it("hook failures report typed errors after collection", [pending()], function* ({ write, cli, exists, read }) {
	yield* write(
		".changeset/changesets.config.ts",
		`import { Effect } from ${JSON.stringify(import.meta.resolve("effect"))};\nimport { ChangesetError } from ${JSON.stringify(new URL("./error.ts", import.meta.url).href)};\nexport default { hooks: [() => Effect.fail(new ChangesetError({ message: 'Repair the repository pins.' }))] };\n`,
	);
	const result = yield* cli("apply");
	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stderr).toContain("Repair the repository pins.");
	expect(yield* exists(".changeset/feature.md")).toBe(false);
	expect(JSON.parse(yield* read("packages/core/package.json")).version).toBe("0.3.0");
});

workspace.it("unstable versions explain the stable release policy", [pending()], function* ({ edit, cli }) {
	yield* edit("packages/core/package.json", (text) => text.replace("0.2.3", "0.3.0-beta.1"));
	const result = yield* cli("check");
	const exitCode = result.status;
	expect(exitCode).toBe(1);
	expect(result.stderr).toContain(`${CORE}: use a stable major.minor.patch version`);
});
