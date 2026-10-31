import { Context, Effect, Option, type Stream, type Types } from "effect";
import type { Rpc } from "effect/rpc";
import type { QueryShape } from "#operation.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { QueryDefinition } from "#serverMetadata.ts";

export interface Viewer {
	readonly id: string;
}
export type QueryReadPolicy<TPayload, E = never, R = never> = (payload: TPayload, viewer: Option.Option<Viewer>) => Effect.Effect<boolean, E, R>;

export const CurrentViewer = Context.Reference<Option.Option<Viewer>>("@shivaedev/contract/CurrentViewer", { defaultValue: Option.none });
export const checkQuery = Effect.fnUntraced(function* <E, R>(query: QueryShape<E, R>, payload: unknown, viewer: Option.Option<Viewer>) {
	if (query.readPolicy === undefined) {
		return yield* new MissingReadPolicy({ message: `Declare a readPolicy on query ${query.name} before running it live or subscribing` });
	}
	if (!(yield* query.readPolicy(payload, viewer))) {
		return yield* new QueryReadDenied({ message: `Read not allowed for query ${query.name}` });
	}
});

// Middleware receives erased RPC metadata; its continuation represents operation failures as unhandled.
export type PolicyChannels<TRpc> = TRpc extends {
	readonly setPayload: unknown;
	readonly errorSchema: { readonly Type: infer E };
	readonly successSchema: { readonly Type: infer TSuccess };
	readonly "~requires": infer R;
}
	? { readonly error: E | (TSuccess extends Stream.Stream<unknown, infer TError, unknown> ? TError : never); readonly services: R }
	: { readonly error: Types.unhandled; readonly services: never };

export function authorizeReads<A, E, R, TRpc extends Rpc.Any>(
	effect: Effect.Effect<A, E, R>,
	request: { readonly rpc: TRpc; readonly payload: unknown },
	viewer: Option.Option<Viewer>,
): Effect.Effect<A, E | PolicyChannels<TRpc>["error"] | MissingReadPolicy | QueryReadDenied, R | PolicyChannels<TRpc>["services"]>;
export function authorizeReads(
	effect: Effect.Effect<unknown, unknown, unknown>,
	request: { readonly rpc: Rpc.Any; readonly payload: unknown },
	viewer: Option.Option<Viewer>,
) {
	return Effect.fnUntraced(function* () {
		const definition = Context.getOption(request.rpc.annotations, QueryDefinition);
		if (Option.isSome(definition) && definition.value.definition.readPolicy !== undefined) {
			yield* checkQuery(definition.value.definition, request.payload, viewer);
		}
		return yield* Effect.provideService(effect, CurrentViewer, viewer);
	})();
}
