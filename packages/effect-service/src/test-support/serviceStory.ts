import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { genericService, requiredService, serviceEngine } from "./serviceEngine.ts";
import { serviceVerbs } from "./serviceVerbs.ts";

export const serviceStory = storyKit({
	create: serviceEngine,
	inspect: ({ counts, declaration }) => ({ ...counts, declaration: declaration.kind }),
	name: "defined service",
	stages: ["declaration"],
	verbs: (engine, story) => serviceVerbs(engine, story.tell),
});

export function declaresRequirement(prefix = "declared") {
	return serviceStory.trait("declaration", `the service declares a requirement with prefix ${prefix}`, (engine) => {
		engine.declaration = { kind: "required", prefix, service: requiredService() };
	});
}

export function declaresGenericMethod() {
	return serviceStory.trait("declaration", "the requirement-free service declares a generic method", (engine) => {
		engine.declaration = { kind: "generic", service: genericService() };
	});
}
