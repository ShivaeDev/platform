import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { genericService, requiredService, scopedService, serviceEngine } from "./serviceEngine.ts";
import { serviceVerbs } from "./serviceVerbs.ts";

export const serviceStory = storyKit({
	create: serviceEngine,
	inspect: ({ built, counts, declaration }) => ({ ...counts, built: built.kind, declaration: declaration.kind }),
	name: "defined service",
	stages: ["declaration"],
	verbs: (engine, story) => serviceVerbs(engine, story.tell),
});

export function declaresScopedService() {
	return serviceStory.trait("declaration", "the service declares scoped initialization and caller resources", (engine) => {
		engine.declaration = { kind: "scoped", service: scopedService(engine.counts) };
	});
}

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
