import { Layer } from "effect";
import { open } from "#adapters/open.ts";
import { VitestRuntime } from "#VitestRuntime.ts";
import { VitestRunner } from "#vitest-runner/service.ts";

export const vitestRunnerLayer = VitestRunner.layer.pipe(Layer.provide(Layer.succeed(VitestRuntime, { open })));
