import { Effect, Schema } from "effect";
import { AccountDayStart, DayStart } from "#server/account-clock/settings.ts";

export const initialize = Effect.flatMap(AccountDayStart, Schema.decodeUnknownEffect(DayStart));
