import { Layer } from "effect";
import { vitestRuntime } from "#adapters/vitestRuntime.ts";
import { VitestRunner } from "./service.ts";

export const vitestRunnerLayer = VitestRunner.layer.pipe(Layer.provide(vitestRuntime));
