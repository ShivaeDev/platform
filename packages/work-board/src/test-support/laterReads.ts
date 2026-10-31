import type { Deferred } from "effect";
import type { ScreenEngine } from "./screenEngine.ts";

export const laterReads = new WeakMap<ScreenEngine, { readonly gate: Deferred.Deferred<void>; started: boolean; readonly url: string }>();
