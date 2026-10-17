import { Effect } from "effect";
import { createRailwayContext, project } from "railway/iac";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import railway from "#railway";

export const railwayProject = storyKit({
	create: () => Effect.promise(() => Promise.resolve(railway(createRailwayContext({ projectName: "notes" }), project))),
	name: "railway project",
	stages: ["configuration"],
	verbs: (definition) => ({ definition }),
});
