import { FileSystem } from "effect";
import { HISTORY, write } from "./fixture.ts";
import { workspace } from "./workspace.ts";

export const ROOT = "@test/root";

export function rootPackage(packages: readonly string[]) {
	return workspace.trait("workspace", `the repository root holds ${ROOT} 0.2.3 and the config selects ${packages.join(", ")}`, function* ({ root }) {
		yield* write(root, "package.json", JSON.stringify({ name: ROOT, type: "module", version: "0.2.3" }));
		yield* write(root, "CHANGELOG.md", HISTORY);
		yield* write(root, ".changeset/changesets.config.ts", `export default { packages: ${JSON.stringify(packages)} };\n`);
	});
}

export const rootHistoryRewritten = workspace.trait("changed", `${ROOT}'s released changelog history is rewritten`, function* ({ root }) {
	const text = yield* (yield* FileSystem.FileSystem).readFileString(`${root}/CHANGELOG.md`);
	yield* write(root, "CHANGELOG.md", text.replace("Released history.", "Edited history."));
});
