import { Cause, Context, Effect, ErrorReporter, Predicate, Schema } from "effect";
import { redactDiagnosticCause } from "#redactCause.ts";
import { isSensitiveKey, redactText } from "#sensitive.ts";

function reportable(value: unknown) {
	return Object.assign(Predicate.isObject(value) ? value : new Error(String(value)), { [ErrorReporter.severity]: "Error" });
}
function reportUnexpected(cause: Cause.Cause<unknown>): Effect.Effect<void> {
	const diagnostic = redactDiagnosticCause(cause);
	return ErrorReporter.report(
		Cause.fromReasons(
			diagnostic.reasons.map((reason) => {
				if (Cause.isInterruptReason(reason)) {
					return reason;
				}
				const reported = Cause.isFailReason(reason) ? Cause.makeFailReason(reportable(reason.error)) : Cause.makeDieReason(reportable(reason.defect));
				return reported.annotate(Context.makeUnsafe(reason.annotations));
			}),
		),
	);
}
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
			Object.defineProperties(rejection, {
				cause: { configurable: true, enumerable: false, value: cause },
				[ErrorReporter.ignore]: { configurable: true, enumerable: false, value: true },
			});
			return reportUnexpected(cause).pipe(
				Effect.andThen(Effect.failCause(Cause.fromReasons([...Cause.fail(rejection).reasons, ...cause.reasons.filter(Cause.isInterruptReason)]))),
			);
		});
}
