import { Layer } from "effect";
import { VitestRuntime } from "#VitestRuntime.ts";
import { open } from "./open.ts";

export const vitestRuntime = Layer.succeed(VitestRuntime, { open });
