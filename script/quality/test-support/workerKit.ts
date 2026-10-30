import { type TestProjectsOptions, testProjects } from "@shivaedev/quality/adapters/testProjects.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

export const workerKit = storyKit({
	create: () => ({ config: testProjects() }),
	name: "test workers",
	stages: [],
	verbs: (state, story) => ({
		configure: (options: TestProjectsOptions) => {
			story.tell(`configure test workers with ${JSON.stringify(options)}`);
			state.config = testProjects(options);
		},
		maxWorkers: () => state.config.maxWorkers,
	}),
});
