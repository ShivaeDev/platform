import { type Clock, Context, type Effect, type Schema, type Scope } from "effect";
import type { SqlError } from "effect/sql/SqlError";

export class WorkerReleaseTesting extends Context.Service<
	WorkerReleaseTesting,
	{
		readonly clock: Clock.Clock;
		readonly register: (tick: {
			readonly heartbeat: Effect.Effect<void, SqlError | Schema.SchemaError>;
			readonly poll: Effect.Effect<void, SqlError | Schema.SchemaError>;
		}) => Effect.Effect<void, never, Scope.Scope>;
	}
>()("@shivaedev/sql/testing/WorkerReleaseTesting") {}
