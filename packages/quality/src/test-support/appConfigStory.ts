import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { TestProjectsOptions } from "#adapters/testProjects.ts";
import { appTestConfig } from "#appTestConfig.ts";

export const appConfigStory = storyKit({
	create: () => ({}),
	name: "Application test config",
	stages: [],
	verbs: (_engine, story) => ({
		generate: (options: TestProjectsOptions) => {
			story.tell(`the application generates its test config with ${JSON.stringify(options)}`);
			return appTestConfig(["source"], options);
		},
	}),
});
