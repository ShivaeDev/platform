import { expect } from "@effect/vitest";
import { workspace } from "#test/workspace.ts";

workspace.it("a new package can collect its first release in the same diff", [], function* ({ write, change, cli, read, checkpoint }) {
	yield* change("first", { "@test/new": "minor" });
	yield* checkpoint();
	yield* write("packages/new/package.json", '{"name":"@test/new","version":"0.0.0"}');
	expect((yield* cli("apply")).status).toBe(0);
	expect(yield* read("packages/new/CHANGELOG.md")).toContain("## 0.1.0 - ");
	expect((yield* cli("check")).status).toBe(0);
});
