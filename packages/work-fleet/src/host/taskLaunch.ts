import { Effect, Schema } from "effect";
import { BadRequest } from "@shivaedev/errors/taxonomy.ts";
import { fleetLaunch } from "#board/fleetField.ts";
import { workMetadata } from "#board/readPass.ts";
import type { BoardWork } from "#policy.ts";
import { LaunchSettings } from "#session/schema.ts";

export const taskLaunch = Effect.fn("FleetHost.taskLaunch")(function* (work: BoardWork) {
	const override = fleetLaunch(yield* workMetadata(work));
	return yield* override === undefined
		? Effect.succeed(undefined)
		: Schema.decodeUnknownEffect(LaunchSettings)(override).pipe(
				Effect.mapError(() => new BadRequest({ message: `${work.workId} has an invalid fleet-launch; use model, effort and serviceTier strings` })),
			);
});
