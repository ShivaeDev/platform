import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { emptyEngine, serve } from "./routerEngine.ts";
import { routerVerbs } from "./routerVerbs.ts";

export const trpc = storyKit({
	after: {
		*router(engine) {
			if (engine.build === undefined) {
				throw new Error("Choose the router's contracts before serving it");
			}
			engine.host = serve(yield* engine.build.run(engine), engine);
		},
	},
	clock: "live",
	create: emptyEngine,
	inspect: ({ finalized, host, instrumented, mapped }) => ({ exchanges: host?.http.exchanges, finalized, instrumented, mapped }),
	name: "tRPC adapter",
	stages: ["router"],
	verbs: (engine, story) => routerVerbs(engine, story.tell),
});

export function requestIs(requestId: string) {
	const trait = `requestIs(${JSON.stringify(requestId)})`;
	return trpc.trait("router", `the request is ${requestId}`, (engine) => {
		if (engine.requestTrait !== undefined) {
			throw new Error(`Request traits ${engine.requestTrait} and ${trait} cannot be combined`);
		}
		engine.requestTrait = trait;
		engine.requestId = requestId;
	});
}

export function customErrorShape() {
	return trpc.trait("router", "the application adds a requestId to its error shape", (engine) => {
		engine.customErrorShape = true;
	});
}
