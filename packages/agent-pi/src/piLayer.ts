import { Layer } from "effect";
import { Backend } from "@shivaedev/agent/backend.ts";
import { makePiBackend } from "#makePiBackend.ts";
import type { PiOptions } from "#PiOptions.ts";
export function piLayer(options: PiOptions = {}): Layer.Layer<Backend> {
	return Layer.effect(Backend, makePiBackend(options));
}
