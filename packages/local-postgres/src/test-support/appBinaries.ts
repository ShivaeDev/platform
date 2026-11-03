import process from "node:process";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Effect, Layer, Option, Result } from "effect";
import { hostPostgresBinaries } from "#server/adapters/hostPostgresBinaries.ts";
import { missingCommand } from "#server/adapters/runCommand.ts";
import { PostgresBinaries } from "#server/PostgresBinaries.ts";

const directory = Option.getOrUndefined(Effect.runSync(Config.String("PLATFORM_LOCAL_POSTGRES_BIN_DIRECTORY").pipe(Config.option)));
export const appServices = Layer.merge(NodeServices.layer, hostPostgresBinaries(directory).pipe(Layer.provide(NodeServices.layer)));

const installed = await Effect.runPromise(
	Effect.gen(function* () {
		return yield* PostgresBinaries;
	}).pipe(Effect.provide(appServices), Effect.result),
);
export const appBinariesInstalled = Result.isSuccess(installed);
if (Result.isFailure(installed)) {
	if (!missingCommand(installed.failure)) {
		throw installed.failure;
	}
	process.stderr.write(`Skipping app-owned PostgreSQL stories: host PostgreSQL binaries are not installed (${installed.failure.command}).\n`);
}
