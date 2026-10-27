import { expectTypeOf } from "vitest";
import { mergeReadPolicies, type ReadKeyPolicy } from "#readPolicy.ts";

expectTypeOf(mergeReadPolicies({})).toEqualTypeOf<ReadKeyPolicy<unknown>>();
expectTypeOf(mergeReadPolicies()).toEqualTypeOf<ReadKeyPolicy<unknown>>();
