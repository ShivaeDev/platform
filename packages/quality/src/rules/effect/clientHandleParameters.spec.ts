import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { carries, effectResolves, serviceModule } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const CLIENT_IMPORTS = [
	'import * as AtomRegistry from "effect/reactivity/AtomRegistry";',
	'import type * as AtomRpc from "effect/reactivity/AtomRpc";',
	'import type { Rpc } from "effect/rpc";',
];

ruleStory.it(
	"effect/service-parameters accepts registries and RPC clients held by plain functions, including ones that build Effects for later",
	[
		effectResolves(),
		repositoryHas(
			serviceModule(
				"src/client.ts",
				...CLIENT_IMPORTS,
				"const owners = new WeakMap<AtomRegistry.AtomRegistry, () => void>();",
				"export function register(registry: AtomRegistry.AtomRegistry, recheck: () => void): () => void { owners.set(registry, recheck); return () => owners.delete(registry); }",
				"export function bindingOwner(scope: string | undefined, registry?: AtomRegistry.AtomRegistry) { return scope === undefined ? undefined : { registry }; }",
				"export function queryRoute<TContext extends { readonly registry: AtomRegistry.AtomRegistry } = { readonly registry: AtomRegistry.AtomRegistry }>(load: (registry: AtomRegistry.AtomRegistry) => void) { return { loader: (context: { readonly context: TContext }) => load(context.context.registry) }; }",
				"export function operations(service: AtomRpc.AtomRpcClient<unknown, string, Rpc.Any>, owner: { readonly registry: AtomRegistry.AtomRegistry } | undefined) {",
				"const run = (effect: Effect.Effect<unknown, unknown>) => owner === undefined ? effect : Effect.suspend(() => AtomRegistry.getResult(owner.registry, service.runtime.atom(effect)));",
				"return { run };",
				"}",
			),
		),
	],
	function* ({ check }) {
		yield* assertThat(yield* check(serviceParameters), (actual) => actual.toEqual([]));
	},
);

ruleStory.it(
	"effect/service-parameters reports a registry or RPC client taken by an Effect body or carried beside another service",
	[
		effectResolves(),
		repositoryHas(
			serviceModule(
				"src/client.ts",
				...CLIENT_IMPORTS,
				"export const traced = Effect.fn(function* (tracedRegistry: AtomRegistry.AtomRegistry) { return tracedRegistry; });",
				'export const named = Effect.fn("named")(function* (namedClient: AtomRpc.AtomRpcClient<unknown, string, Rpc.Any>) { return namedClient; });',
				"export const inner = Effect.gen(function* () { return (innerRegistry: AtomRegistry.AtomRegistry) => innerRegistry; });",
				"export const mixed = (held: { readonly registry: AtomRegistry.AtomRegistry; readonly store: StoreShape }) => held.registry;",
			),
		),
	],
	function* ({ check, messages }) {
		yield* check(serviceParameters);

		yield* assertThat(yield* messages(), (actual) =>
			actual.toEqual([carries("tracedRegistry"), carries("namedClient"), carries("held"), carries("innerRegistry")]),
		);
	},
);
