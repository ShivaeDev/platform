import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { seed } from "#server/seed.ts";

NodeRuntime.runMain(seed);
