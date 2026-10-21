import { expect } from "vitest";
import { archiveInventory } from "#package-check/test-support/archiveInventory.ts";
import { archives } from "#package-check/test-support/archives.ts";
import { aliasedExport, executableExport, selectedPattern, sharedExport } from "#package-check/test-support/exportTraits.ts";
import { claudePlugin, privateAddon } from "#package-check/test-support/privateAddon.ts";

archives.it("accepts shared archives from this commit with their packed checksums", [privateAddon], function* ({ verify }) {
	expect(yield* verify()).toBeUndefined();
});

for (const [problem, message] of [
	["commit", "another commit"],
	["missing", "inventory does not match"],
	["version", "wrong version"],
	["checksum", "checksum mismatch"],
] as const) {
	archives.it(`rejects shared archives with a ${problem} mismatch`, [privateAddon, archiveInventory(problem)], function* ({ verify }) {
		expect(yield* verify()).toContain(message);
	});
}

archives.it("private addons remain covered by packed consumers before a release is authorized", [privateAddon], function* ({ packages, check }) {
	expect((yield* packages()).map(({ manifest }) => ({ name: manifest.name, private: manifest.private }))).toEqual([
		{ name: "@example/addon", private: true },
	]);
	expect(yield* check()).toBeUndefined();
});

archives.it("leaves Claude Code plugin folders out of the npm archives", [privateAddon, claudePlugin], function* ({ packages }) {
	expect((yield* packages()).map(({ manifest }) => manifest.name)).toEqual(["@example/addon"]);
});

archives.it("checks mapped executables without importing them as library entries", [executableExport], function* ({ check, consumerEntries }) {
	expect(yield* check()).toBeUndefined();
	expect(yield* consumerEntries()).toEqual([{ blocked: [], exported: [{ json: false, specifier: "board/board.ts" }] }]);
});

archives.it("keeps exact shared exports out of blocked consumer entries", [sharedExport], function* ({ consumerEntries }) {
	expect(yield* consumerEntries()).toEqual([
		{ blocked: ["board/browser/responses/form.ts"], exported: [{ json: false, specifier: "board/browser/responses/schema.ts" }] },
	]);
});

archives.it("checks an exact blocked entry when the defining module has a public alias", [aliasedExport], function* ({ consumerEntries }) {
	expect(yield* consumerEntries()).toEqual([{ blocked: ["router/loadQuery.ts"], exported: [{ json: false, specifier: "router/router.ts" }] }]);
});

archives.it("enumerates modules and build targets through their selected export pattern", [selectedPattern], function* ({ check, consumerEntries }) {
	expect(yield* check()).toBeUndefined();
	expect(yield* consumerEntries()).toEqual([
		{ blocked: ["board/server/rpc/present.ts"], exported: [{ json: false, specifier: "board/rpc/present.ts" }] },
	]);
});
