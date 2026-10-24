import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { applicationHost } from "./applicationHost.ts";

NodeRuntime.runMain(Layer.launch(applicationHost()));
