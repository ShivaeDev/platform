import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { setupDatabases } from "@shivaedev/server/setupDatabases.ts";

NodeRuntime.runMain(setupDatabases());
