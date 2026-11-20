import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Layer } from "effect";
import { applicationWorker } from "#server/applicationWorker.ts";
import { workerTeardown } from "#server/workerTeardown.ts";

NodeRuntime.runMain(Layer.launch(applicationWorker()), { teardown: workerTeardown });
