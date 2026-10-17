import { Effect, Fiber, Option } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { SqlClient } from "effect/sql";

export const healthRoute = HttpRouter.use((router) =>
	Effect.gen(function* () {
		const database = yield* Effect.serviceOption(SqlClient.SqlClient);
		const scope = yield* Effect.scope;
		const probe = Effect.gen(function* () {
			if (Option.isNone(database)) {
				return 503;
			}
			const query = yield* database.value`select 1`.pipe(Effect.forkIn(scope));
			return yield* Fiber.join(query).pipe(
				Effect.timeout("2 seconds"),
				// Driver cancellation may need network I/O; keep cleanup in the host scope without delaying the response.
				Effect.ensuring(Fiber.interrupt(query).pipe(Effect.forkIn(scope), Effect.asVoid)),
				Effect.match({ onFailure: () => 503, onSuccess: () => 200 }),
			);
		});
		yield* router.add(
			"GET",
			"/health",
			Effect.map(probe, (status) => HttpServerResponse.empty({ headers: { "cache-control": "no-store" }, status })),
		);
	}),
);
