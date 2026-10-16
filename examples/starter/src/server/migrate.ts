import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { migrateDatabase } from "./migrateDatabase.ts";

NodeRuntime.runMain(migrateDatabase.pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
