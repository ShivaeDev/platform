import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Path } from "effect";
import { type FleetHost, HostFailure } from "#host/config.ts";

export const hostReviewerGuidance = Effect.fn("FleetHost.hostReviewerGuidance")(function* (host: FleetHost) {
	const guidance = host.worker?.reviewerGuidance;
	if (guidance === undefined || typeof guidance === "string") {
		return guidance;
	}
	return yield* Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const file = path.resolve(host.boardDir, guidance.file);
		return yield* fs
			.readFileString(file)
			.pipe(Effect.mapError(() => new HostFailure({ message: `Fleet reviewer guidance is missing or unreadable: ${file}` })));
	}).pipe(Effect.provide(NodeServices.layer));
});
