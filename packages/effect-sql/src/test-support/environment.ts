import { Config, Effect, Option } from "effect";

export function environmentVariable(name: string): string | undefined {
	return Option.getOrUndefined(Effect.runSync(Config.option(Config.string(name))));
}
