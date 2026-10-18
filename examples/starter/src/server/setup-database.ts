import { NodeRuntime } from "@effect/platform-node";
import { setupDatabases } from "#server/setupDatabases.ts";

NodeRuntime.runMain(setupDatabases());
