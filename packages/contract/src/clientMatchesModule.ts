import type { RpcGroup } from "effect/rpc";

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
