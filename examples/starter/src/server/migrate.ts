import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { migrateDatabase } from "./migrateDatabase.ts";

NodeRuntime.runMain(Effect.scoped(migrateDatabase()));
