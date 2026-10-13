import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { noteWorker } from "./noteWorker.ts";

NodeRuntime.runMain(Layer.launch(noteWorker()));
