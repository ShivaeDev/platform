import { Effect, type Option } from "effect";
import type { QueryShape } from "#operation.ts";
import type { Viewer } from "#readPolicy.ts";

export const queryReadKeys = Effect.fnUntraced(function* <E, R>(query: QueryShape<E, R>, payload: unknown, viewer: Option.Option<Viewer>) {
	const derived = query.serverReads === undefined ? [] : yield* query.serverReads(payload, viewer);
	return [...query.reads(payload, viewer), ...derived];
});
