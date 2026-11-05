import type { DateTime } from "effect";
import type { EffectTestOptions } from "@shivaedev/test/types.ts";

export type StoryClock = "test" | DateTime.Utc;

export type StoryTestOptions = Omit<EffectTestOptions, "clock"> & { readonly clock?: StoryClock };
