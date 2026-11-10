import { Cause, Context, Effect, ErrorReporter, Predicate, Schema } from "effect";
import { infrastructureRejection } from "#infrastructure.ts";
import { redactDiagnosticCause } from "#redactCause.ts";
import { isSensitiveKey, redactText } from "#sensitive.ts";

class ReportableError extends Error {
	override readonly [ErrorReporter.severity] = "Error";
}

function reportable(value: unknown) {
	const message = Predicate.isObject(value) && "message" in value ? String(value.message) : String(value);
	const reported = new ReportableError(message);
	if (Predicate.isObject(value)) {
		for (const key of Reflect.ownKeys(value)) {
			if (key === "message" || key === "stack" || key === ErrorReporter.severity) {
				continue;
			}
			const descriptor = Object.getOwnPropertyDescriptor(value, key);
			if (descriptor !== undefined) {
				Object.defineProperty(reported, key, descriptor);
			}
		}
		if ("stack" in value) {
			reported.stack = String(value.stack);
		}
	}
	return reported;
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
function declaredCause<E>(cause: Cause.Cause<unknown>, declared: (value: unknown) => value is E) {
	const reasons: Cause.Reason<E>[] = [];
	const infrastructure: Cause.Reason<unknown>[] = [];
	for (const reason of cause.reasons) {
		if (Cause.isInterruptReason(reason)) {
			reasons.push(reason);
			continue;
		}
		if (!Cause.isFailReason(reason)) {
			return undefined;
		}
		const rejection = declared(reason.error) ? undefined : infrastructureRejection(reason.error);
		const answer = rejection ?? reason.error;
		if (!declared(answer)) {
			return undefined;
		}
		if (rejection !== undefined) {
			infrastructure.push(reason);
		}
		reasons.push(Cause.makeFailReason(answer).annotate(Context.makeUnsafe(reason.annotations)));
	}
	return { cause: Cause.fromReasons(reasons), infrastructure };
}
export interface RpcBoundaryOptions<E> {
	readonly message?: string;
	readonly unexpected: (message: string) => E;
}
export function rpcBoundary<TSchema extends Schema.Constraint>(schema: TSchema, options: RpcBoundaryOptions<TSchema["Type"]>) {
	const declared = Schema.is(schema);
	return <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, TSchema["Type"], R> =>
		Effect.catchCause(self, (cause) => {
			if (Cause.hasInterruptsOnly(cause)) {
				return Effect.failCause(Cause.fromReasons(cause.reasons.filter(Cause.isInterruptReason)));
			}
			const expected = declaredCause(cause, declared);
			if (expected !== undefined) {
				// Retryable failures are not bugs, so they skip the error reporter, but an operator still needs to see them.
				const warned =
					expected.infrastructure.length === 0
						? Effect.void
						: Effect.logWarning("RPC infrastructure failure", redactDiagnosticCause(Cause.fromReasons(expected.infrastructure)));
				return warned.pipe(Effect.andThen(Effect.failCause(expected.cause)));
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
