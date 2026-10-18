import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { createAdmin } from "#server/createAdmin.ts";

NodeRuntime.runMain(Effect.scoped(createAdmin().pipe(Effect.tap(() => Effect.logInfo("Administrator created")))));
