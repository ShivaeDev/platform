import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";
import { createAdmin } from "#server/admin/create.ts";

NodeRuntime.runMain(createAdmin.pipe(Effect.tap((admin) => Effect.logInfo(`Administrator ready: ${admin.email}`))));
