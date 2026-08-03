import { Context } from "effect";

/** The transport cancellation signal for the current tRPC procedure. */
export const RequestSignal = Context.Reference<AbortSignal | undefined>(
	"@shivaedev/effect-trpc/RequestSignal",
	{ defaultValue: () => undefined },
);
