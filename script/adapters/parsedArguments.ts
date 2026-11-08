import { type ParseArgsConfig, parseArgs } from "node:util";
import { Effect } from "effect";

export function parsedArguments<const T extends ParseArgsConfig>(config: T) {
	return Effect.try(() => parseArgs(config));
}
