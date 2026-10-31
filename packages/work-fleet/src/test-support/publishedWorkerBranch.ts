import { engineConfiguration } from "#test/engineConfiguration.ts";

export const publishedWorkerBranch = engineConfiguration("the worker branch already has a published PR", (state) => {
	if (state.github === undefined) {
		throw new Error("A GitHub pull request must be configured");
	}
	return { publicationQuery: state.github.publication };
});
