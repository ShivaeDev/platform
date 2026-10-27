import { Context, Effect, Option } from "effect";
import type { Rpc } from "effect/rpc";
import type { QueryShape } from "#operation.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { QueryDefinition } from "#serverMetadata.ts";

export interface Viewer {
	readonly id: string;
}
export type QueryReadPolicy<TPayload> = (payload: TPayload, viewer: Option.Option<Viewer>) => Effect.Effect<boolean, never, unknown>;

export const CurrentViewer = Context.Reference<Option.Option<Viewer>>("@shivaedev/contract/CurrentViewer", { defaultValue: Option.none });
export const checkQuery = Effect.fnUntraced(function* (query: QueryShape, payload: unknown, viewer: Option.Option<Viewer>) {
	if (query.readPolicy === undefined) {
		return yield* new MissingReadPolicy({ message: `Declare a readPolicy on query ${query.name} before running it live or subscribing` });
	}
	const context = Context.makeUnsafe<unknown>((yield* Effect.context<never>()).mapUnsafe);
	if (!(yield* Effect.provideContext(query.readPolicy(payload, viewer), context))) {
		return yield* new QueryReadDenied({ message: `Read not allowed for query ${query.name}` });
	}
});

export const authorizeReads = Effect.fnUntraced(function* <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	request: { readonly rpc: Rpc.AnyWithProps; readonly payload: unknown },
	viewer: Option.Option<Viewer>,
) {
	const definition = Context.getOption(request.rpc.annotations, QueryDefinition);
	if (Option.isSome(definition) && definition.value.readPolicy !== undefined) {
		yield* checkQuery(definition.value, request.payload, viewer);
	}
	return yield* Effect.provideService(effect, CurrentViewer, viewer);
});
