import { Layer } from "effect";
import { applicationWorker } from "./applicationWorker.ts";
import { runWorker } from "./runWorker.ts";

runWorker(Layer.launch(applicationWorker()));
