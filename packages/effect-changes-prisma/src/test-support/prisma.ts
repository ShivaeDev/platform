import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { databaseUrl } from "./environment.ts";
import { prismaEngine } from "./prismaEngine.ts";
import { prismaVerbs } from "./prismaVerbs.ts";

const kit = storyKit({
	clock: "live",
	create: prismaEngine,
	inspect: ({ binding, seen }) => ({ observations: binding.observations, published: binding.published, seen, unnamed: binding.unnamed }),
	name: "prisma changes",
	stages: ["connection", "data", "behavior"],
	verbs: (engine, story) => prismaVerbs(engine, story.tell),
});

export const prisma = { ...kit, it: kit.it.runIf(databaseUrl !== undefined) };
