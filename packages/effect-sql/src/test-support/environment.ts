import { Config, Effect, Option } from "effect";

export const environmentVariable = (name: string): string | undefined => Option.getOrUndefined(Effect.runSync(Config.option(Config.string(name))));
