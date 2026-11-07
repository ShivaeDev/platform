import { Layer } from "effect";
import { applicationWorker } from "#server/applicationWorker.ts";
import { runWorker } from "#server/runWorker.ts";

runWorker(Layer.launch(applicationWorker()));
