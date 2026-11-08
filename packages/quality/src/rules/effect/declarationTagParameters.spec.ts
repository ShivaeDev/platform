import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { carries, effectResolves, serviceModule } from "#test/effectPolicyFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

const RPC_IMPORTS = [
	'import type { Rpc, RpcGroup, RpcMiddleware } from "effect/rpc";',
	"interface Group { middleware: (middleware: RpcMiddleware.AnyService) => Group }",
];

ruleStory.it(
	"effect/service-parameters accepts tags that a function only hands to middleware declarations or Context.pick",
	[
		effectResolves(),
		repositoryHas(
			serviceModule(
				"src/declarations.ts",
				...RPC_IMPORTS,
				"export function adminPage(page: { readonly id: string; readonly permission: RpcMiddleware.AnyService }): { readonly id: string };",
				"export function adminPage(page: { readonly id: string; readonly permission: RpcMiddleware.AnyService }, group?: RpcGroup.RpcGroup<Rpc.Any>) {",
				"const { permission, ...definition } = page;",
				"return { ...definition, key: permission.key, contract: group?.middleware(page.permission) };",
				"}",
				"export function withDeclaration(group: Group): Group {",
				"const nativeMiddleware = group.middleware.bind(group);",
				"return { middleware: (middleware: RpcMiddleware.AnyService) => withDeclaration(nativeMiddleware(middleware)) };",
				"}",
				"export interface Declared extends RpcGroup.RpcGroup<Rpc.Any> { middleware: <TM extends RpcMiddleware.AnyService>(middleware: TM) => Declared }",
				"export const declare = (group: Declared): Declared => group;",
				"const bindRequirements = (definition: { readonly requires: readonly Context.Key<any, any>[]; readonly methods: () => unknown }) => [Context.pick(...definition.requires), definition.methods()];",
				"export const defineThing = (definition: { readonly requires: readonly Context.Key<any, any>[]; readonly methods: () => unknown }) => bindRequirements(definition);",
				"export const declared = (definition: { readonly requires: readonly Context.Key<any, any>[] }, ambient: Context.Context<never>) => Context.pick(...definition.requires)(ambient);",
			),
		),
	],
	function* ({ check }) {
		yield* assertThat(yield* check(serviceParameters), (actual) => actual.toEqual([]));
	},
);

ruleStory.it(
	"effect/service-parameters reports a tag that is yielded, called or handed to anything but a declaration",
	[
		effectResolves(),
		repositoryHas(
			serviceModule(
				"src/declarations.ts",
				...RPC_IMPORTS,
				"export function readHandlers<TService>(queues: readonly string[], service: Context.Service<TService, StoreShape>) {",
				'return { read: Effect.fn("read")(function* () { const runtime = yield* service; return [queues, runtime]; }) };',
				"}",
				"export const both = (group: Group, declaredAndRead: RpcMiddleware.AnyService) => Effect.gen(function* () { group.middleware(declaredAndRead); return yield* declaredAndRead; });",
				"export const piped = (group: Group, piping: RpcMiddleware.AnyService) => [group.middleware(piping), piping.pipe()];",
				"export const notMiddleware = (holder: { middleware: (tag: unknown) => void }, plainTag: typeof Store) => holder.middleware(plainTag);",
				"export interface Guarded { guard: <TM extends RpcMiddleware.AnyService>(guardTag: TM) => Guarded }",
				"export const guarded = (group: Guarded): Guarded => group;",
				"const readsTag = (reading: { readonly tag: typeof Store }) => Effect.gen(function* () { return yield* reading.tag; });",
				"export const forwards = (forwarded: { readonly tag: typeof Store }) => readsTag(forwarded);",
				"export const unused = (neverDeclared: RpcMiddleware.AnyService) => 1;",
				"export const shorthand = (group: Group, escapes: RpcMiddleware.AnyService) => [group.middleware(escapes), { escapes }];",
			),
		),
	],
	function* ({ check, messages }) {
		yield* check(serviceParameters);

		yield* assertThat(yield* messages(), (actual) =>
			actual.toEqual([
				carries("service"),
				carries("declaredAndRead"),
				carries("piping"),
				carries("plainTag"),
				carries("guardTag"),
				carries("forwarded"),
				carries("neverDeclared"),
				carries("escapes"),
				carries("reading"),
			]),
		);
	},
);
