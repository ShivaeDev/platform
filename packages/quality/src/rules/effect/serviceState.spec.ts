import { expect } from "@effect/vitest";
import { serviceModel } from "#rules/effect/serviceModel.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { builtClient, modelFiles, serviceResolves } from "#test/serviceModelFiles.ts";

for (const [name, initialize] of [
	["a service key used directly as the initializer", "Store"],
	["a repository", "Effect.gen(function* () { return yield* Store; })"],
	["a ref that can retain dependencies after initialization", "Ref.make<StoreShape | undefined>(undefined)"],
	["a dependency hidden in a ref", "Effect.gen(function* () { return yield* Ref.make(yield* Store); })"],
	["a nested dependency bundle", "Effect.gen(function* () { return { nested: { store: yield* Store } }; })"],
	["SqlClient", "Effect.gen(function* () { return yield* SqlClient.SqlClient; })"],
	["an HTTP client", "Effect.gen(function* () { return yield* HttpClient.HttpClient; })"],
	["optional configuration", "Effect.map(OptionalSettings, (settings) => settings)"],
	["a scalar config service", "Effect.gen(function* () { return yield* Prefix; })"],
	["configuration", "Effect.gen(function* () { return yield* Settings; })"],
	["a pure closure over config", "Effect.gen(function* () { const settings = yield* Settings; return { endpoint: () => settings.endpoint }; })"],
	["a closure over a repository", "Effect.gen(function* () { const store = yield* Store; return { read: () => store.read() }; })"],
] as const) {
	ruleStory.it(
		`service model rejects initializer state containing ${name}`,
		[effectResolves(), serviceResolves(), repositoryHas(...modelFiles(initialize))],
		function* ({ check }) {
			const findings = yield* check(serviceModel);

			expect(findings).toEqual([
				expect.objectContaining({
					file: "src/inventory/service.ts",
					message: expect.stringContaining("Initializer state carries a dependency. Declare it in requires and yield it in each operation."),
				}),
			]);
		},
	);
}

for (const [name, initialize] of [
	["a ref", "Ref.make(0)"],
	["a closure over an owned ref", "Effect.gen(function* () { const count = yield* Ref.make(0); return { read: () => Ref.get(count) }; })"],
	["an owned scope", "Scope.make()"],
	["the Layer's scope", "Effect.gen(function* () { return yield* Scope.Scope; })"],
	[
		"an acquired handle with an Effect finalizer",
		"Effect.acquireRelease(Effect.sync(() => ({ close: () => Effect.void })), (handle) => handle.close())",
	],
	["an aliased caller", "Effect.gen(function* () { const ActingUser = Subject; return { caller: yield* ActingUser }; })"],
	["the per-request caller", "Effect.gen(function* () { return { caller: yield* Subject }; })"],
	["a lock", "Semaphore.make(1)"],
	["a cached operation", "Effect.gen(function* () { return { today: yield* Effect.cached(load()) }; })"],
	[
		"a cache and captured caller data",
		"Effect.gen(function* () { const caller = yield* Subject; return { cache: new Map<string, string>(), callerId: caller.id, count: yield* Ref.make(0) }; })",
	],
] as const) {
	ruleStory.it(
		`service model accepts owned lifetime state with ${name}`,
		[effectResolves(), serviceResolves(), repositoryHas(...modelFiles(initialize))],
		function* ({ check }) {
			const findings = yield* check(serviceModel);

			expect(findings).toEqual([]);
		},
	);
}

ruleStory.it(
	"service model rejects a service returned by a named initializer factory",
	[
		effectResolves(),
		serviceResolves(),
		repositoryHas(
			...modelFiles("acquire()").map((file) => ({
				...file,
				content: file.content.replace(
					"export const initialize",
					"const acquire = Effect.fnUntraced(function* () { return yield* Store; });\nexport const initialize",
				),
			})),
		),
	],
	function* ({ check }) {
		expect(yield* check(serviceModel)).toEqual([
			expect.objectContaining({ message: expect.stringContaining("Initializer state carries a dependency.") }),
		]);
	},
);

ruleStory.it(
	"service model rejects a callable dependency hidden inside caller state",
	[
		effectResolves(),
		serviceResolves(),
		repositoryHas(
			...modelFiles("Effect.gen(function* () { return yield* Subject; })").map((file) => ({
				...file,
				content: file.content.replace("Subject, { readonly id: string }", "Subject, { readonly client: StoreShape }"),
			})),
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceModel);

		expect(findings).toEqual([expect.objectContaining({ message: expect.stringContaining("Initializer state carries a dependency.") })]);
	},
);

ruleStory.it(
	"service model rejects client capabilities built from SqlClient in another module",
	[
		effectResolves(),
		serviceResolves(),
		repositoryHas(
			builtClient,
			...modelFiles("buildClient").map((file) =>
				file.path.endsWith("initialize.ts") ? { ...file, content: `import { buildClient } from "./buildClient.ts";\n${file.content}` } : file,
			),
		),
	],
	function* ({ check }) {
		const findings = yield* check(serviceModel);

		expect(findings).toEqual([expect.objectContaining({ message: expect.stringContaining("Initializer state carries a dependency.") })]);
	},
);
