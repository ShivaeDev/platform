import { rmSync } from "node:fs";
import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { checkRepository } from "#changelog/checkRepository.ts";
import { releasePackage } from "#changelog/releasePackage.ts";
import { repository } from "./repository.ts";

export const EDITOR = "### Fixed\n\n- Save drafts.\n";
export const QUERY = "### Added\n\n- Query subscriptions.\n";

export const changelog = storyKit({
	*create() {
		const fixture = yield* Effect.acquireRelease(Effect.sync(repository), (acquired) => Effect.sync(acquired.remove));
		return { base: fixture.commit(), fixture };
	},
	layer: NodeFileSystem.layer,
	name: "changelog",
	stages: ["release"],
	verbs: (state, story) => ({
		checks: () => {
			story.tell("the changelog validator checks the release against its base");
			return checkRepository(state.fixture.root, state.base);
		},
		edit: (path: string, text: string) => {
			story.tell(`the PR writes ${path}`);
			state.fixture.write(path, text);
		},
		laterFragmentLands: () => {
			story.tell("a query fragment lands on main after the release was cut");
			state.fixture.git("switch", "main");
			state.fixture.write("changes/query.md", QUERY);
			state.base = state.fixture.commit();
			state.fixture.git("switch", "release");
			state.fixture.git("merge", "main", "--no-edit");
		},
		read: (path: string) => state.fixture.read(path),
		remove: (path: string) => {
			story.tell(`the PR deletes ${path}`);
			rmSync(join(state.fixture.directory, path));
		},
	}),
});

export function releaseIsCut() {
	return changelog.trait("release", "the release collects the editor fragment", function* (state) {
		state.fixture.write("changes/editor.md", EDITOR);
		state.base = state.fixture.commit();
		state.fixture.git("switch", "-c", "release");
		state.fixture.version("1.1.0");
		yield* releasePackage(state.fixture.directory, "2026-10-18");
		state.fixture.commit();
	});
}
