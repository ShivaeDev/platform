import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { effectResolves, serviceModule } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const ENVIRONMENT_FORMS = [
	{ code: "export const computation = (work: Effect.Effect<string, never, Store>) => work;", name: "an Effect that requires the service" },
	{
		code: 'import { Stream } from "effect";\nexport const stream = (work: Stream.Stream<string, never, Store>) => work;',
		name: "a Stream that requires the service",
	},
	{ code: "export const empty = (services: Context.Context<never>) => services;", name: "an empty Context" },
	{
		code: "export const constrainedEmpty = <T extends never>(services: Context.Context<T>) => services;",
		name: "a Context constrained to no services",
	},
	{ code: 'import { Layer } from "effect";\nexport const layer = (store: StoreShape) => Layer.succeed(Store)(store);', name: "a Layer constructor" },
	{
		code: 'import { Layer } from "effect";\nexport const unwrappedLayer = (store: StoreShape) => Layer.unwrap(Effect.succeed(Layer.succeed(Store)(store)));',
		name: "a Layer constructor that unwraps an Effect",
	},
	{
		code: 'import { Layer } from "effect";\nexport const curriedLayer = () => (store: StoreShape) => Layer.succeed(Store)(store);',
		name: "a Layer constructor a function returns",
	},
	{
		code: [
			'export class Other extends Context.Service<Other, { run: (store: StoreShape) => Effect.Effect<string> }>()("Other") {}',
			"export const implementation = { run: (store: StoreShape) => store.read() } satisfies Context.Service.Shape<typeof Other>;",
		].join("\n"),
		name: "a method of a service implementation",
	},
];

ruleStory.it(
	"effect/service-parameters accepts computations, empty Contexts, Layer constructors and service implementations",
	[
		effectResolves(),
		repositoryHas(...ENVIRONMENT_FORMS.map(({ code }, index) => serviceModule(`src/environment-${String(index).padStart(2, "0")}.ts`, code))),
	],
	function* ({ check }) {
		expect(yield* check(serviceParameters)).toEqual([]);
	},
);

ruleStory.it(
	"effect/service-parameters checks an adapters/ folder like any other source",
	[effectResolves(), repositoryHas(serviceModule("src/adapters/store.ts", "export const direct = (store: Store) => store;"))],
	function* ({ check, locations }) {
		yield* check(serviceParameters);

		expect(yield* locations()).toEqual(["src/adapters/store.ts:2"]);
	},
);

ruleStory.it(
	"effect/service-parameters exempts a test-support/ folder",
	[effectResolves(), repositoryHas(serviceModule("src/test-support/store.ts", "export const direct = (store: Store) => store;"))],
	function* ({ check }) {
		expect(yield* check(serviceParameters)).toEqual([]);
	},
);
