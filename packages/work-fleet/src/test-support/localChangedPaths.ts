import { changedPathRepository } from "#test/changedPathRepository.ts";
import { engine } from "#test/engineStory.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";

export function localChangedPaths(files: readonly string[], reported: number, listed: number, brokenRemote = false) {
	return engine.trait("integrations", "the PR has a local repository and an incomplete GitHub file listing", function* (state) {
		const repository = yield* changedPathRepository(files);
		if (brokenRemote) {
			repository.breakRemote();
		}
		const github = yield* mergedReviewGithub(repository.boardDir);
		Object.assign(github.state, {
			base: repository.base,
			changedFiles: reported,
			filePages: [Array.from({ length: listed }, (_, index) => ({ filename: `main/file-${index}.ts` }))],
			head: repository.head,
		});
		state.github = github;
		state.options = { ...state.options, ...github };
	});
}
