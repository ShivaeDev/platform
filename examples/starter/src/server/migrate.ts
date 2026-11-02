import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";
import { migrateDatabase } from "#server/migrateDatabase.ts";

NodeRuntime.runMain(migrateDatabase().pipe(Effect.scoped, Effect.provide(NodeCrypto.layer)));
