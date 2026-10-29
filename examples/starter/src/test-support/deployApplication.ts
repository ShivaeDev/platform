import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Layer } from "effect";
import { applicationHost } from "#server/applicationHost.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { runWorker } from "#server/runWorker.ts";
import { testPoolSizes } from "./poolSizes.ts";

if (process.argv[2] === "web") {
	NodeRuntime.runMain(Layer.launch(applicationHost({ poolSizes: testPoolSizes })));
} else {
	runWorker(Layer.launch(applicationWorker({ poolSizes: testPoolSizes })));
}
