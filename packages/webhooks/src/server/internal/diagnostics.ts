import { Cause, Effect, Predicate } from "effect";

export function diagnosticError(error: unknown) {
	return { _tag: Predicate.hasProperty(error, "_tag") && typeof error._tag === "string" ? error._tag : "Unknown" };
}

export function privateFailures<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return effect.pipe(
		Effect.catchCause((cause) =>
			Effect.failCause(
				Cause.fromReasons(
					cause.reasons.map((reason) => {
						if (Cause.isFailReason(reason)) {
							return Cause.makeFailReason(diagnosticError(reason.error));
						}
						return Cause.isDieReason(reason) ? Cause.makeDieReason(diagnosticError(reason.defect)) : reason;
					}),
				),
			),
		),
	);
}
