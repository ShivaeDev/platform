import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { adapterServiceFiles } from "#test/adapterServiceFiles.ts";
import { effectResolves, serviceModule } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { serviceKitFiles, serviceKitResolves } from "#test/serviceKitFiles.ts";

ruleStory.it(
	"service parameters accepts a foreign server constructed and passed inside an adapter",
	[effectResolves(), repositoryHas(...adapterServiceFiles)],
	function* ({ check }) {
		expect(yield* check(serviceParameters)).toEqual([]);
	},
);

ruleStory.it(
	"service parameters rejects the same foreign server when it comes from the environment",
	[
		effectResolves(),
		repositoryHas(
			...adapterServiceFiles.map((file) =>
				file.path.endsWith("renderer-tooling.ts")
					? {
							...file,
							content: `import { RendererServer } from "../../../../src/RendererServer.ts";\n${file.content.replace("Effect.promise(() => createServer())", "RendererServer")}`,
						}
					: file,
			),
		),
	],
	function* ({ check }) {
		expect(yield* check(serviceParameters)).toEqual([
			expect.objectContaining({ message: expect.stringContaining("Parameter server carries a service.") }),
		]);
	},
);

ruleStory.it(
	"service parameters rejects an environment resource passed from another adapter module",
	[
		effectResolves(),
		repositoryHas(...adapterServiceFiles, {
			content: `import { Effect } from "effect";
import { RendererServer } from "../../../../src/RendererServer.ts";
import { close } from "./renderer-tooling.ts";
export const borrowed = Effect.gen(function* () { yield* close(yield* RendererServer); });`,
			path: "apps/desktop/script/adapters/borrowed.ts",
		}),
	],
	function* ({ check }) {
		expect(yield* check(serviceParameters)).toEqual([
			expect.objectContaining({ message: expect.stringContaining("Parameter server carries a service.") }),
		]);
	},
);

ruleStory.it(
	"service parameters follows a foreign factory through typed promise acquisition",
	[
		effectResolves(),
		repositoryHas(
			...adapterServiceFiles.map((file) => ({
				...file,
				content: file.content.replace(
					"Effect.promise(() => createServer())",
					"Effect.tryPromise({ try: () => createServer(), catch: (cause) => cause })",
				),
			})),
		),
	],
	function* ({ check }) {
		expect(yield* check(serviceParameters)).toEqual([]);
	},
);

for (const path of ["src/runtime.ts", "src/adapters/runtime.ts"]) {
	ruleStory.it(
		`service parameters rejects non-exported runtime service plumbing in ${path}`,
		[effectResolves(), repositoryHas(serviceModule(path, "function local(store: StoreShape) { return store.read(); }"))],
		function* ({ check }) {
			expect(yield* check(serviceParameters)).toEqual([expect.objectContaining({ file: path })]);
		},
	);
}

ruleStory.it(
	"service parameters keeps test-kit engine arguments separate from runtime services",
	[
		effectResolves(),
		repositoryHas(
			serviceModule("src/test-support/kit.ts", "export const inspect = (store: StoreShape) => store;"),
			serviceModule("src/runtime.ts", "function local(store: StoreShape) { return store.read(); }"),
		),
	],
	function* ({ check }) {
		expect(yield* check(serviceParameters)).toEqual([expect.objectContaining({ file: "src/runtime.ts" })]);
	},
);

ruleStory.it(
	"service parameters accepts story-kit engine callbacks beside a rejected runtime helper",
	[effectResolves(), serviceKitResolves(), repositoryHas(...serviceKitFiles)],
	function* ({ check }) {
		expect(yield* check(serviceParameters)).toEqual([
			expect.objectContaining({ file: "src/application-story.ts", message: expect.stringContaining("Parameter store carries a service.") }),
			expect.objectContaining({ file: "src/application-story.ts", message: expect.stringContaining("Parameter store carries a service.") }),
		]);
	},
);
