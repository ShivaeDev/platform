import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { applicationWorker } from "./applicationWorker.ts";

NodeRuntime.runMain(Layer.launch(applicationWorker()));
