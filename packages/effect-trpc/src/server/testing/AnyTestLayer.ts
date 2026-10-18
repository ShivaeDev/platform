import type { Layer } from "effect";
export type AnyTestLayer = Layer.Layer<any, any, never> | Layer.Layer<never, any, never>;
