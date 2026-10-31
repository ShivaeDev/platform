import { expect } from "vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { carries, effectResolves, serviceModule } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

const ALIASES = ["type Renamed = StoreShape;", "interface Wrapper { readonly store: Renamed }"];

const SERVICE_FORMS = [
	{
		code: "const shorthand = (store: Renamed) => store; export const exposed = { shorthand };",
		name: "a function an exported object holds by shorthand",
		parameter: "store",
	},
	{
		code: "export function makeGeneric<T>() { return (store: T) => store; } export const generic = makeGeneric<Renamed>();",
		name: "a function a generic factory returns",
		parameter: "store",
	},
	{
		code: "export const optional = () => true ? ((store: Renamed) => store) : undefined;",
		name: "a function an optional result holds",
		parameter: "store",
	},
	{ code: "export declare const declared: (store: Renamed) => StoreShape;", name: "a declared function", parameter: "store" },
	{
		code: "const methods = { run: (store: Renamed) => store }; export const methodAlias = methods.run;",
		name: "an exported alias of an object method",
		parameter: "store",
	},
	{ code: "export const direct = (store: Store) => store;", name: "a function that takes the service", parameter: "store" },
	{ code: "export const alias = (store: Renamed) => store;", name: "a function that takes a type alias of the service shape", parameter: "store" },
	{ code: "export const destructured = ({ store }: Wrapper) => store;", name: "a destructured parameter", parameter: "{ store }" },
	{
		code: "export const constrained = <T extends Renamed>(store: T) => store;",
		name: "a type parameter constrained to the service shape",
		parameter: "store",
	},
	{ code: "export const factory = () => ({ run: (store: Renamed) => store });", name: "a method of an object a factory returns", parameter: "store" },
	{
		code: "export function context(services: Context.Context<Store>) { return services; }",
		name: "a Context that holds the service",
		parameter: "services",
	},
	{ code: "export class Client { run(store: Renamed) { return store; } }", name: "a public class method", parameter: "store" },
	{
		code: "const local = (store: Renamed) => store; export { local as renamed };",
		name: "a function exported under another name",
		parameter: "store",
	},
	{
		code: "export const inferred: (store: Renamed) => string = (store) => String(store);",
		name: "a parameter whose type is inferred",
		parameter: "store",
	},
	{ code: "export const tag = (store: typeof Store) => store;", name: "a function that takes the service key", parameter: "store" },
	{ code: "export default (store: Renamed) => store;", name: "a default export", parameter: "store" },
	{
		code: "export const collection = (stores: readonly StoreShape[]) => stores;",
		name: "a function that takes an array of service shapes",
		parameter: "stores",
	},
	{ code: "export const tuple = () => [(store: Renamed) => store] as const;", name: "a function a returned tuple holds", parameter: "store" },
	{
		code: "const wrap = <T>(value: T) => value; export const wrapped = wrap((store: Renamed) => store);",
		name: "a function a generic wrapper passes through",
		parameter: "store",
	},
	{
		code: "export const nested = () => ({ factory: () => ({ run: ({ store }: Wrapper) => store }) });",
		name: "a method a nested factory returns",
		parameter: "{ store }",
	},
	{
		code: 'import { FileSystem } from "effect";\nexport const native = (fs: FileSystem.FileSystem) => fs;',
		name: "a function that takes Effect's own FileSystem service",
		parameter: "fs",
	},
	{
		code: 'export const wrapped = Effect.fn("Wrapped.run")(function* (store: StoreShape) { return yield* store.read(); });',
		name: "a generator that Effect.fn wraps",
		parameter: "store",
	},
	{
		code: [
			"const RenamedService = Context.Service;",
			"interface RenamedShape { readonly renamedRead: () => Effect.Effect<string> }",
			'export class Renamed extends RenamedService<Renamed, RenamedShape>()("Renamed") {}',
			'const renamedBuilder = Effect.fn("Renamed.run");',
			"export const renamed = renamedBuilder(function* (renamedStore: RenamedShape) { return yield* renamedStore.renamedRead(); });",
		].join("\n"),
		name: "a service declared through a renamed Context.Service and wrapped by a renamed Effect.fn builder",
		parameter: "renamedStore",
	},
];

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

for (const { code, name, parameter } of SERVICE_FORMS) {
	ruleStory.it(
		`effect/service-parameters reports the service parameter of ${name}`,
		[effectResolves(), repositoryHas(serviceModule("src/store.ts", ...ALIASES, code))],
		function* ({ check, messages }) {
			yield* check(serviceParameters);

			expect(yield* messages()).toEqual([carries(parameter)]);
		},
	);
}

for (const { code, name } of ENVIRONMENT_FORMS) {
	ruleStory.it(
		`effect/service-parameters accepts ${name}`,
		[effectResolves(), repositoryHas(serviceModule("src/store.ts", code))],
		function* ({ check }) {
			expect(yield* check(serviceParameters)).toEqual([]);
		},
	);
}

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
