import { Effect } from "effect";
import * as Statement from "effect/sql/Statement";

export const captureStatement = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
	const statements: (readonly [string, readonly unknown[]])[] = [];
	const rows = yield* effect.pipe(
		Effect.provideService(Statement.CurrentTransformer, (statement) => {
			statements.push(statement.compile());
			return Effect.succeed(statement);
		}),
	);
	return { rows, statements };
});
