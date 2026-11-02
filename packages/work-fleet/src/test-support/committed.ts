import { Context, Effect, Option, Stream } from "effect";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { fleetRecords } from "#fleetRecords.ts";

export function committed<A, E, R>(
	context: Context.Context<typeof LiveServer.Identifier>,
	workId: string,
	read: Effect.Effect<A, E, R>,
	ready: (value: A) => boolean,
) {
	return Stream.unwrap(Context.get(context, LiveServer).stream([fleetRecords.item(workId)])).pipe(
		Stream.mapEffect(() => read),
		Stream.filter(ready),
		Stream.take(1),
		Stream.runHead,
		Effect.map(Option.getOrThrow),
	);
}
