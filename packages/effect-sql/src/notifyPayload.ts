import { Effect, Schema } from "effect";
import { SqlError, UnknownError } from "effect/unstable/sql/SqlError";

export const NotificationKeys = Schema.Array(Schema.Union([Schema.String, Schema.Finite]));
export const decodeKeys = Schema.decodeUnknownEffect(Schema.fromJsonString(NotificationKeys));
const encoder = new TextEncoder();

export function notificationError(message: string, cause: unknown = message) {
	return new SqlError({ reason: new UnknownError({ cause, message, operation: "notify" }) });
}

export const encodeKeys = Effect.fn("PostgresChanges.encodeKeys")(function* (keys: readonly unknown[]) {
	const valid = yield* Schema.decodeUnknownEffect(NotificationKeys)(keys).pipe(
		Effect.mapError((cause) => notificationError("PostgreSQL invalidation keys must be strings or finite numbers", cause)),
	);
	const payloads: string[] = [];
	let batch: Array<string | number> = [];
	for (const key of valid) {
		const next = [...batch, key];
		if (encoder.encode(JSON.stringify(next)).length >= 8000) {
			if (batch.length === 0 || encoder.encode(JSON.stringify([key])).length >= 8000) {
				return yield* Effect.fail(notificationError("A PostgreSQL invalidation key exceeds the NOTIFY payload limit"));
			}
			payloads.push(JSON.stringify(batch));
			batch = [key];
		} else {
			batch = next;
		}
	}
	if (batch.length > 0) {
		payloads.push(JSON.stringify(batch));
	}
	return payloads;
});
