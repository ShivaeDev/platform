import { Layer } from "effect";
import { open } from "#adapters/open.ts";
import { VitestRuntime } from "#VitestRuntime.ts";

export const vitestRuntime = Layer.succeed(VitestRuntime, { open });
