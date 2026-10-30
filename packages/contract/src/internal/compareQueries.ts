import { Crypto, Effect, Schema } from "effect";
import * as Hex from "effect/encoding/Hex";
import type { Key } from "@shivaedev/changes/keys.ts";
import { changedHint } from "#internal/queryHints.ts";
import type { LiveHint } from "#live.ts";
import type { QueryRerun, QuerySubscription } from "#querySubscription.ts";
import type { QueryResult, QueryUpdate } from "#queryUpdate.ts";
import type { QueryRequest } from "#serverMetadata.ts";

function hintsFor(hint: LiveHint, subscription: QuerySubscription<unknown, unknown>): readonly LiveHint[] {
	const queries = subscription.queries ?? [];
	if (!queries.some(({ query }) => query.live === "rerun-and-compare")) {
		if (hint._tag === "Resync") {
			return [hint];
		}
		return hint.keys.length > 0 ? [changedHint(hint.keys, subscription.scopes)] : [];
	}
	const scopes = subscription.scopes.map((scope, index) => (queries[index]?.query.live === "rerun-and-compare" ? [] : scope));
	if (queries.every(({ query }) => query.live === "rerun-and-compare")) {
		return [];
	}
	if (hint._tag === "Resync") {
		return [hint];
	}
	const keys = new Set(scopes.flatMap((scope) => scope.map((key) => JSON.stringify(key))));
	const visible: readonly Key[] = hint.keys.filter((key) => keys.has(JSON.stringify(key)));
	return visible.length === 0 ? [] : [changedHint(visible, scopes)];
}

export function compareQueries<E, R>(subscription: QuerySubscription<unknown, unknown>, read?: QueryRerun<E, R>) {
	const queries = subscription.queries ?? [];
	const hashes = new Map<number, string>();
	const resultFor = Effect.fnUntraced(function* (request: QueryRequest, index: number) {
		if (read === undefined) {
			return yield* Effect.die(new Error("Rerun-and-compare subscriptions require an authorized query runner"));
		}
		const value = yield* read(request);
		const encoded = yield* Schema.encodeUnknownEffect(Schema.toCodecJson(request.query.success))(value).pipe(Effect.orDie);
		const crypto = yield* Crypto.Crypto;
		const digest = yield* crypto.digest("SHA-256", new TextEncoder().encode(JSON.stringify(encoded))).pipe(Effect.orDie);
		const hash = Hex.encode(digest);
		if (hash === hashes.get(index)) {
			return undefined;
		}
		hashes.set(index, hash);
		return { _tag: "Result", query: request.query.name, queryIndex: index, value } satisfies QueryResult;
	});
	return Effect.fnUntraced(function* (hint: LiveHint) {
		const updates: QueryUpdate[] = [];
		const affected = hint._tag === "Resync" ? undefined : changedHint(hint.keys, subscription.scopes);
		const matching = queries
			.map((request, index) => ({ index, request }))
			.filter(
				({ index, request }) =>
					request.query.live === "rerun-and-compare" && (affected?._tag !== "Changed" || affected.queryIndexes?.includes(index)),
			);
		for (const { index, request } of matching) {
			const result = yield* resultFor(request, index);
			if (result !== undefined) {
				updates.push(result);
			}
		}
		return [...updates, ...hintsFor(hint, subscription)];
	});
}
