import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { setupDatabases } from "@shivaedev/server/setupDatabases.ts";

NodeRuntime.runMain(setupDatabases().pipe(Effect.provide(NodeServices.layer)));
