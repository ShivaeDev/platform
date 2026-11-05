import { Effect } from "effect";
import { PgBossInitialization } from "./PgBossInitialization.ts";

export const initializeJobs = Effect.flatten(PgBossInitialization);
