import process from "node:process";
import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { applicationHost } from "#server/applicationHost.ts";
import { applicationWorker } from "#server/applicationWorker.ts";
import { testPoolSizes } from "./poolSizes.ts";

NodeRuntime.runMain(
	Layer.launch(process.argv[2] === "web" ? applicationHost({ poolSizes: testPoolSizes }) : applicationWorker({ poolSizes: testPoolSizes })),
);
