import { Cause, Effect, Schema } from "effect";
import { isSensitiveKey, redactText } from "@shivaedev/errors/sensitive.ts";
export interface RpcBoundaryOptions<E> {
	readonly message?: string;
	readonly unexpected: (message: string) => E;
}
export function rpcBoundary<
	TSchema extends Schema.ConstraintDecoder<{
		readonly message: string;
	}>,
>(schema: TSchema, options: RpcBoundaryOptions<TSchema["Type"]>) {
	const declared = Schema.is(schema);
	return <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, TSchema["Type"], R> =>
		Effect.catchCause(self, (cause) => {
			if (Cause.hasInterruptsOnly(cause)) {
				return Effect.failCause(Cause.fromReasons(cause.reasons.filter(Cause.isInterruptReason)));
			}
			const reason = cause.reasons[0];
			if (cause.reasons.length === 1 && reason && Cause.isFailReason(reason) && declared(reason.error)) {
				return Effect.fail(reason.error);
			}
			const rejection = options.unexpected(redactText(options.message ?? "Internal server error", isSensitiveKey));
			Object.defineProperty(rejection, "cause", { configurable: true, enumerable: false, value: cause });
			return Effect.failCause(Cause.fromReasons([...Cause.fail(rejection).reasons, ...cause.reasons.filter(Cause.isInterruptReason)]));
		});
}
