import { appTestConfig } from "@shivaedev/test-kits/quality/appTestConfig.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";

export const appConfigStory = storyKit({
	create: () => ({}),
	name: "Application test config",
	stages: [],
	verbs: (_engine, story) => ({
		generate: (options: NonNullable<Parameters<typeof appTestConfig>[1]>) => {
			story.tell(`the application generates its test config with ${JSON.stringify(options)}`);
			return appTestConfig(["@shivaedev/source"], options);
		},
	}),
});
