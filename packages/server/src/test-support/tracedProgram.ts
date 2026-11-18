import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Effect } from "effect";
import { otlpTracing } from "#otlpTracing.ts";

NodeRuntime.runMain(Effect.void.pipe(Effect.withSpan("checkout"), Effect.provide(otlpTracing)));
