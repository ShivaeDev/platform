import { Context, type Effect } from "effect";

export class PassState extends Context.Service<
	PassState,
	{
		readonly running: Effect.Effect<void>;
		readonly waiting: (nextDue: number | undefined) => Effect.Effect<void>;
	}
>()("@shivaedev/reconciler/PassState") {}
