import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appBinariesInstalled, appServices } from "#test/appBinaries.ts";
import { createAppInstance } from "#test/appInstanceEngine.ts";
import { appInstanceReadouts } from "#test/appInstanceReadouts.ts";
import { appInstanceVerbs } from "#test/appInstanceVerbs.ts";

export const appInstance = storyKit({
	clock: "live",
	create: () => createAppInstance,
	inspect: (engine) => ({ dataDirectory: engine.dataDirectory, instance: engine.instance, outcome: engine.outcome }),
	layer: appServices,
	name: "app-owned PostgreSQL",
	runIf: appBinariesInstalled,
	stages: [],
	verbs: (engine, story) => ({ ...appInstanceVerbs(engine, story), ...appInstanceReadouts(engine) }),
});
