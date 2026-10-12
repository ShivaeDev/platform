import { NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { starterHost } from "./starterHost.ts";

NodeRuntime.runMain(Layer.launch(starterHost()));
