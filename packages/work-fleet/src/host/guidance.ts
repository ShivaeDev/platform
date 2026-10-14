import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Option, Path } from "effect";
import { type FleetHost, HostFailure } from "#host/config.ts";

export const hostGuidance = Effect.fn("FleetHost.hostGuidance")(function* (host: FleetHost, role: "worker" | "reviewer") {
	const guidance = role === "worker" ? host.worker?.workerGuidance : host.worker?.reviewerGuidance;
	if (guidance === undefined || typeof guidance === "string") {
		return Effect.succeed(guidance);
	}
	const read = yield* Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const file = path.resolve(host.boardDir, guidance.file);
		let cached: { readonly modified: number; readonly text: string } | undefined;
		return Effect.gen(function* () {
			const stat = yield* fs.stat(file);
			const modified = Option.getOrUndefined(stat.mtime)?.getTime();
			if (modified !== undefined && cached?.modified === modified) {
				return cached.text;
			}
			const text = yield* fs.readFileString(file);
			cached = modified === undefined ? undefined : { modified, text };
			return text;
		}).pipe(Effect.mapError(() => new HostFailure({ message: `Fleet ${role} guidance is missing or unreadable: ${file}` })));
	}).pipe(Effect.provide(NodeServices.layer));
	yield* read;
	return read;
});
