import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Layer } from "effect";
import { applicationHost } from "#server/applicationHost.ts";

NodeRuntime.runMain(Layer.launch(applicationHost()));
