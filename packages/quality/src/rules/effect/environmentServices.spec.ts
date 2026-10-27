import { expect } from "vitest";
import { effectPolicyStory, policyFiles } from "#effect-policy-story";
import { REJECTED_SERVICE_SOURCE, SERVICE_CASES, SERVICE_DECLARATION } from "#test/effectPolicyFiles.ts";

const REJECTED_PATHS = ["src/store.ts", "src/adapters/store.ts"];

effectPolicyStory.it(
	"aliases, interfaces, constraints, inferred and destructured parameters and factory methods carry services",
	[policyFiles(...REJECTED_PATHS.map((path) => ({ content: REJECTED_SERVICE_SOURCE, path })))],
	function* ({ lint }) {
		const result = yield* lint();
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("effect/service-parameters");
		expect(result.stdout.match(/Parameter .+ carries a service\./gu)).toHaveLength(SERVICE_CASES.length * REJECTED_PATHS.length);
		for (const name of ["store", "{ store }", "services"]) {
			expect(result.stdout).toContain(`Parameter ${name} carries a service.`);
		}
		expect(result.stdout).toContain("src/adapters/store.ts");
	},
);

effectPolicyStory.it(
	"test kits, computations with requirements, service implementation methods and Layer constructors are accepted",
	[
		policyFiles(
			{ content: REJECTED_SERVICE_SOURCE, path: "src/test-support/store.ts" },
			{ content: `${SERVICE_DECLARATION} export const sentinel = (store: Store) => store;`, path: "src/sentinel.ts" },
			{
				content: `${SERVICE_DECLARATION}
import { Layer, Stream } from "effect";
export const computation = (work: Effect.Effect<string, never, Store>) => work;
export const stream = (work: Stream.Stream<string, never, Store>) => work;
export const empty = (services: Context.Context<never>) => services;
export const constrainedEmpty = <T extends never>(services: Context.Context<T>) => services;
export const layer = (store: StoreShape) => Layer.succeed(Store)(store);
export const unwrappedLayer = (store: StoreShape) => Layer.unwrap(Effect.succeed(Layer.succeed(Store)(store)));
export const curriedLayer = () => (store: StoreShape) => Layer.succeed(Store)(store);
export class Other extends Context.Service<Other, { run: (store: StoreShape) => Effect.Effect<string> }>()("Other") {}
export const implementation = { run: (store: StoreShape) => store.read() } satisfies Context.Service.Shape<typeof Other>;`,
				path: "src/store.ts",
			},
		),
	],
	function* ({ lint, writes }) {
		expect((yield* lint()).stdout).toContain("Parameter store carries a service.");
		yield* writes({ content: "export function sentinel() { return 1; }", path: "src/sentinel.ts" });
		const result = yield* lint();
		expect(result.stdout).not.toContain("effect/service-parameters");
	},
);

effectPolicyStory.it(
	"Effect.fn wrappers and renamed service factories keep service parameters visible",
	[
		policyFiles({
			content: `${SERVICE_DECLARATION}
import { FileSystem } from "effect";
export const native = (fs: FileSystem.FileSystem) => fs;
const RenamedService = Context.Service;
interface RenamedShape { readonly renamedRead: () => Effect.Effect<string> }
export class Renamed extends RenamedService<Renamed, RenamedShape>()("Renamed") {}
export const wrapped = Effect.fn("Wrapped.run")(function* (store: StoreShape) { return yield* store.read(); });
const renamedBuilder = Effect.fn("Renamed.run");
export const renamed = renamedBuilder(function* (renamedStore: RenamedShape) { return yield* renamedStore.renamedRead(); });`,
			path: "src/wrapped.ts",
		}),
	],
	function* ({ lint }) {
		const result = yield* lint();
		expect(result.stdout).toContain("effect/service-parameters");
		expect(result.stdout).toContain("Parameter store carries a service.");
		expect(result.stdout).toContain("Parameter fs carries a service.");
		expect(result.stdout).toContain("Parameter renamedStore carries a service.");
	},
);
