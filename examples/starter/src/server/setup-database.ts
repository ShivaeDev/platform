import { NodeRuntime } from "@effect/platform-node";
import { setupDatabases } from "@shivaedev/platform/server/setupDatabases.ts";

NodeRuntime.runMain(setupDatabases());
