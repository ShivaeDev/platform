import { NodeRuntime } from "@effect/platform-node";
import { setupDatabases } from "@shivaedev/server/setupDatabases.ts";

NodeRuntime.runMain(setupDatabases());
