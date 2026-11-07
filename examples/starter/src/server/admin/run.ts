import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";
import { createAdmin } from "#server/admin/create.ts";

NodeRuntime.runMain(Effect.scoped(createAdmin().pipe(Effect.tap(() => Effect.logInfo("Administrator created")))));
