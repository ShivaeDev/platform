import { Context } from "effect";

export const RequestSignal = Context.Reference<AbortSignal | undefined>("@shivaedev/effect-trpc/RequestSignal", { defaultValue: () => undefined });
