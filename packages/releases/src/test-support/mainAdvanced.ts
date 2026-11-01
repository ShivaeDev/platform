import { git } from "#git.ts";
import { changeset, write } from "./fixture.ts";
import { workspace } from "./workspace.ts";

export const mainAdvanced = workspace.trait(
	"changed",
	"main merges a breaking core change and an independent dev fix before the release enters the merge queue",
	function* ({ root }) {
		yield* git(root, ["add", "."]);
		yield* git(root, ["commit", "--allow-empty", "-m", "Prepare release branch"]);
		yield* git(root, ["switch", "main"]);
		for (const [file, name, bump, section, note] of [
			["breaking", "@test/core", "minor", "Breaking", "Replace the core API; migrate to the new API."],
			["independent", "@test/dev", "patch", "Fixed", "Correct independent dev behavior."],
		] as const) {
			yield* write(root, `.changeset/${file}.md`, changeset({ [name]: bump }, `### ${section}\n\n- ${note}\n`));
			yield* write(root, `packages/${name.slice("@test/".length)}/index.ts`, `export const behavior = ${JSON.stringify(note)};\n`);
			yield* git(root, ["add", "."]);
			yield* git(root, ["commit", "-m", note]);
		}
		yield* git(root, ["switch", "feature"]);
		yield* git(root, ["merge", "--no-edit", "main"]);
	},
);

export const recordedReleaseBase = workspace.trait("main", "the release records its base revision", function* ({ root }) {
	const base = yield* git(root, ["rev-parse", "HEAD"]);
	yield* write(root, ".changeset/release-base", base);
});

export const squashedRelease = workspace.trait("changed", "main squash-merges the frozen release", function* ({ root }) {
	yield* git(root, ["switch", "main"]);
	yield* git(root, ["merge", "--squash", "feature"]);
	yield* git(root, ["commit", "-m", "Release approved versions"]);
});

export const baseFromReleaseBranch = workspace.trait("changed", "the recorded base points to the release commit outside main", function* ({ root }) {
	yield* write(root, ".changeset/release-base", yield* git(root, ["rev-parse", "HEAD^1"]));
});
