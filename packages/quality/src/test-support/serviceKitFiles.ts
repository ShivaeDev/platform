import { createRequire } from "node:module";
import { dirname } from "node:path";
import { serviceModule } from "#test/effectPolicyFiles.ts";
import { repositoryLinks } from "#test/ruleStory.ts";

export function serviceKitResolves() {
	return repositoryLinks("node_modules/@shivaedev/test-story", dirname(createRequire(import.meta.url).resolve("@shivaedev/test-story/package.json")));
}

export const serviceKitFiles = [
	serviceModule(
		"src/application-story.ts",
		'import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";',
		`const kit = storyKit({
 name: "Application", stages: ["ready"],
 create: () => Effect.gen(function* () { return { store: yield* Store }; }),
 inspect: (engine) => ({ store: engine.store }),
 verbs: (engine) => ({ read: () => engine.store.read(), ask: (run: (store: StoreShape) => Effect.Effect<string>) => run(engine.store) }),
});
export const ready = kit.trait("ready", "store is ready", (engine) => engine.store.read());
kit.it("runs a story", [], function* ({ ask }) {
 yield* ask((store) => store.read());
 function runtimeInside(store: StoreShape) { return store.read(); }
});
function runtime(store: StoreShape) { return store.read(); }`,
	),
];

export function serviceKitDataFiles(runtime: boolean) {
	return [
		{
			content: `import { Context } from "effect";
export interface EngineState { readonly count: number }
export class FixtureState extends Context.Service<FixtureState, EngineState>()("fixture/State") {}`,
			path: "src/test-support/state.ts",
		},
		{
			content: `import { Context } from "effect";
import type { EngineState } from "./test-support/state.ts";
${runtime ? 'export class RuntimeState extends Context.Service<RuntimeState, EngineState>()("app/State") {}' : ""}
export function inspect(state: EngineState) { return state.count; }`,
			path: "src/state.ts",
		},
	];
}
