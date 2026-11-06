import { Effect, Schema } from "effect";
import { Digest } from "effect/crypto";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { LiveHint } from "#live.ts";
import type { QueryRerun, QuerySubscription } from "#querySubscription.ts";
import type { QueryResult, QueryUnchanged, QueryUpdate } from "#queryUpdate.ts";
import type { QueryRequest } from "#serverMetadata.ts";

export function compareQueries<E, R>(
	subscription: QuerySubscription<unknown, unknown>,
	read: QueryRerun<E, R>,
	initialRead?: boolean,
): (hint: LiveHint, scopes?: readonly (readonly Key[])[]) => Effect.Effect<readonly QueryUpdate[], E, R>;
export function compareQueries<E, R>(subscription: QuerySubscription<unknown, unknown>, read: QueryRerun<E, R>, initialRead = true) {
	const queries = subscription.queries;
	const hashes = new Map<number, string>();
	let initial = initialRead && queries.length > 0;
	const resultFor = Effect.fnUntraced(function* (request: QueryRequest, index: number) {
		const value = yield* read(request);
		const encoded = yield* Schema.encodeUnknownEffect(Schema.toCodecJson(request.query.success))(value).pipe(Effect.orDie);
		const digest = yield* Digest.Digest;
		const hash = yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(JSON.stringify(encoded)));
		if (hash === hashes.get(index)) {
			return { _tag: "Unchanged", queryIndex: index } satisfies QueryUnchanged;
		}
		hashes.set(index, hash);
		return { _tag: "Result", query: request.query.name, queryIndex: index, value } satisfies QueryResult;
	});
	return Effect.fnUntraced(function* (hint: LiveHint, scopes: readonly (readonly Key[])[] = subscription.scopes) {
		const updates: QueryUpdate[] = [];
		const changed = new Set(hint._tag === "Changed" ? hint.keys.map((key) => JSON.stringify(key)) : []);
		const matching = queries
			.map((request, index) => ({ index, request }))
			.filter(({ index }) => initial || hint._tag === "Resync" || scopes[index]?.some((key) => changed.has(JSON.stringify(key))));
		for (const { index, request } of matching) {
			const result = yield* resultFor(request, index);
			updates.push(result);
		}
		initial = false;
		return updates;
	});
}
