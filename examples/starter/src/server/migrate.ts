import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";
import { migrateDatabase } from "#server/migrateDatabase.ts";

NodeRuntime.runMain(Effect.scoped(migrateDatabase()));
