import type { Option, Schema } from "effect";
import type { RpcGroup, RpcMiddleware } from "effect/rpc";
import type { Key } from "@shivaedev/changes/keys.ts";
import { declaredGroup } from "#contract.ts";
import type { ModuleContract } from "#defineModule.ts";
import type { Command, Operation, PayloadSchema } from "#operation.ts";
import { operation } from "#operationDeclaration.ts";
import type { Viewer } from "#readPolicy.ts";
import type { RejectionSpecs } from "#rejection.ts";
import type { SpecsOf } from "#runProof.ts";
import type { SubjectDeclaration } from "#subject.ts";
import { type Wire, type WireEntry, wireRejections } from "#wire.ts";

export interface ClientQuery<TName extends string, TPayload extends Schema.Top, TSuccess extends Schema.Top, TSpecs extends RejectionSpecs>
	extends Operation<TName, TPayload, TSuccess, TSpecs> {
	readonly kind: "query";
	reads: (payload: TPayload["Type"], viewer: Option.Option<Viewer>) => readonly Key[];
}

type Payloads<TWire> = { readonly [TOperation in keyof TWire]?: Schema.Top | Schema.Struct.Fields };
type PayloadOf<TPayloads, TOperation> = PayloadSchema<TOperation extends keyof TPayloads ? NonNullable<TPayloads[TOperation]> : Schema.Void>;
type EntryOf<TWire, TOperation> = TOperation extends keyof TWire ? (TWire[TOperation] extends WireEntry ? TWire[TOperation] : never) : never;

interface QueryKeys<TPayload> {
	readonly reads: (payload: TPayload, viewer: Option.Option<Viewer>) => readonly Key[];
	readonly readsCollections?: readonly { readonly name: string }[];
}

interface CommandKeys<TPayload, TResult> {
	readonly invalidates?: (payload: TPayload, result: TResult, viewer?: Option.Option<Viewer>) => readonly Key[];
}

type ClientQueries<TWire, TPayloads, TQueries extends string> = {
	readonly [TOperation in TQueries]: ClientQuery<
		TOperation,
		PayloadOf<TPayloads, TOperation>,
		EntryOf<TWire, TOperation>["success"],
		SpecsOf<EntryOf<TWire, TOperation>["rejections"]>
	>;
}[TQueries];

type ClientCommands<TWire, TPayloads, TCommands extends string> = {
	readonly [TOperation in TCommands]: Command<
		TOperation,
		PayloadOf<TPayloads, TOperation>,
		EntryOf<TWire, TOperation>["success"],
		SpecsOf<EntryOf<TWire, TOperation>["rejections"]>
	>;
}[TCommands];

export interface ClientContractDefinition<
	TName extends string,
	TWire extends Wire,
	TPayloads extends Payloads<TWire>,
	TQueries extends keyof TWire & string,
	TCommands extends keyof TWire & string,
	TMiddleware extends RpcMiddleware.AnyService,
	TSubject extends SubjectDeclaration | undefined,
	TScope extends "session" | undefined,
> {
	readonly commands?: {
		readonly [TOperation in TCommands]: CommandKeys<PayloadOf<TPayloads, TOperation>["Type"], EntryOf<TWire, TOperation>["success"]["Type"]>;
	};
	readonly keyScope?: TScope;
	readonly middleware?: TMiddleware;
	readonly name: TName;
	readonly payloads?: TPayloads;
	readonly queries?: { readonly [TOperation in TQueries]: QueryKeys<PayloadOf<TPayloads, TOperation>["Type"]> };
	readonly subject?: TSubject;
	readonly wire: TWire;
}

// Written by the generator: what the browser needs of a module as values, without its run, read policy or services.
export function clientContract<
	const TName extends string,
	const TWire extends Wire,
	const TPayloads extends Payloads<TWire> = Record<never, never>,
	TQueries extends keyof TWire & string = never,
	TCommands extends keyof TWire & string = never,
	TMiddleware extends RpcMiddleware.AnyService = never,
	const TSubject extends SubjectDeclaration | undefined = undefined,
	const TScope extends "session" | undefined = undefined,
>(
	definition: ClientContractDefinition<TName, TWire, TPayloads, TQueries, TCommands, TMiddleware, TSubject, TScope>,
): ModuleContract<
	TName,
	readonly (ClientQueries<TWire, TPayloads, TQueries> | ClientCommands<TWire, TPayloads, TCommands>)[],
	TMiddleware,
	TSubject,
	TScope
>;
export function clientContract(definition: {
	readonly commands?: { readonly [operation: string]: CommandKeys<unknown, unknown> };
	readonly keyScope?: "session";
	readonly middleware?: RpcMiddleware.AnyService;
	readonly name: string;
	readonly payloads?: { readonly [operation: string]: Schema.Top | Schema.Struct.Fields | undefined };
	readonly queries?: { readonly [operation: string]: QueryKeys<unknown> };
	readonly subject?: SubjectDeclaration;
	readonly wire: Wire;
}): unknown {
	function declared(name: string) {
		const entry = definition.wire[name];
		const payload = definition.payloads?.[name];
		return {
			...(payload === undefined ? {} : { payload }),
			...(entry === undefined ? {} : { rejections: wireRejections(entry.rejections), success: entry.success }),
		};
	}
	const queries = Object.entries(definition.queries ?? {}).map(([name, { reads, readsCollections = [] }]) => {
		const collections: readonly Key[] = readsCollections.map((collection) => ({ _tag: "List", collection: collection.name }));
		return {
			...operation("query", name, declared(name)),
			reads: (payload: unknown, viewer: Option.Option<Viewer>) => [...reads(payload, viewer), ...collections],
		};
	});
	const commands = Object.entries(definition.commands ?? {}).map(([name, { invalidates }]) => ({
		...operation("command", name, declared(name)),
		invalidates: invalidates ?? (() => []),
	}));
	const group = declaredGroup(definition.name, {
		commands,
		queries,
		...(definition.keyScope === undefined ? {} : { keyScope: definition.keyScope }),
		...(definition.subject === undefined ? {} : { subject: definition.subject }),
	});
	return definition.middleware?.key === undefined ? group : group.middleware(definition.middleware);
}

type Rpcs<TGroup> = TGroup extends RpcGroup.RpcGroup<infer TRpcs> ? TRpcs : never;
type Same<TLeft, TRight> = [TLeft] extends [TRight] ? ([TRight] extends [TLeft] ? true : false) : false;
type OperationOf<TTag> = TTag extends `${string}.${infer TOperation}` ? TOperation : TTag;

type Differing<TClient, TModule> = {
	readonly [TTag in Rpcs<TClient>["_tag"] | Rpcs<TModule>["_tag"]]: Same<
		Extract<Rpcs<TClient>, { readonly _tag: TTag }>,
		Extract<Rpcs<TModule>, { readonly _tag: TTag }>
	> extends true
		? never
		: OperationOf<TTag>;
}[Rpcs<TClient>["_tag"] | Rpcs<TModule>["_tag"]];

export interface ClientDiffersFromModule<TOperations, TFix extends string> {
	readonly fix: TFix;
	readonly operations: TOperations;
}

// A generated file ends with `export const matches: ClientMatchesModule<typeof Client, typeof Module> = true;`.
export type ClientMatchesModule<TClient, TModule> = [Differing<TClient, TModule>] extends [never]
	? true
	: ClientDiffersFromModule<Differing<TClient, TModule>, "the generated file is stale; run pnpm generate">;
