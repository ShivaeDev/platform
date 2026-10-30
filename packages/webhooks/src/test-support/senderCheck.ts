import { Context, Data, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";

export class SenderCheckFailed extends Data.TaggedError("SenderCheckFailed") {}

export class SenderPreferences extends Context.Service<
	SenderPreferences,
	{ readonly allows: (sender: string, at: number) => Effect.Effect<boolean, SenderCheckFailed> }
>()("@test/SenderPreferences") {}

export const senderPreferences = Layer.effect(
	SenderPreferences,
	Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		return {
			allows: (sender: string, at: number) =>
				sql<{ allowed: boolean }>`select allowed_until > to_timestamp(${at} / 1000.0) as allowed from webhook_senders where sender = ${sender}`.pipe(
					Effect.map((rows) => rows[0]?.allowed ?? false),
					Effect.mapError(() => new SenderCheckFailed()),
				),
		};
	}),
);
