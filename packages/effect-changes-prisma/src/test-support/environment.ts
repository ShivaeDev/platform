import { Config, Effect, Option } from "effect";

export const databaseUrl = Option.getOrUndefined(Effect.runSync(Config.option(Config.string("PLATFORM_EFFECT_CHANGES_PRISMA_TEST_DATABASE_URL"))));
