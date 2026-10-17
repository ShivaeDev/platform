import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { notesHost } from "./notesHost.ts";

NodeRuntime.runMain(Layer.launch(notesHost()));
