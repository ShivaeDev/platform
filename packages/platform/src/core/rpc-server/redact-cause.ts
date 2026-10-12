import { Cause, Context, ErrorReporter, Predicate } from "effect";
import { redact } from "./redact.ts";
import { isSensitiveKey, redactText, type SensitiveKey } from "./sensitive.ts";

function reporterHints(error: Error, sensitive: SensitiveKey) {
	return {
		...(ErrorReporter.isIgnored(error) ? { [ErrorReporter.ignore]: true } : {}),
		...(ErrorReporter.severity in error ? { [ErrorReporter.severity]: ErrorReporter.getSeverity(error) } : {}),
		...(ErrorReporter.attributes in error ? { [ErrorReporter.attributes]: redact(ErrorReporter.getAttributes(error), sensitive) } : {}),
	};
}

function redactError(error: Error, sensitive: SensitiveKey): Error {
	const options = error.cause === undefined ? undefined : { cause: redact(error.cause, sensitive) };
	const copy = new Error(redactText(error.message, sensitive), options);
	Object.defineProperty(copy, "name", { configurable: true, value: error.name, writable: true });
	Object.defineProperty(copy, "stack", {
		configurable: true,
		value: error.stack === undefined ? undefined : redactText(error.stack, sensitive),
		writable: true,
	});
	return Object.assign(copy, redact(Object.fromEntries(Object.entries(error)), sensitive), reporterHints(error, sensitive));
}

export const redactDefect = (defect: unknown, sensitive: SensitiveKey = isSensitiveKey): unknown =>
	Predicate.isError(defect) ? redactError(defect, sensitive) : redact(defect, sensitive);

export const redactCause = <E>(cause: Cause.Cause<E>, sensitive: SensitiveKey = isSensitiveKey): Cause.Cause<E> =>
	Cause.fromReasons(
		cause.reasons.flatMap<Cause.Reason<E>>((reason) =>
			Cause.isDieReason(reason)
				? Cause.annotate(Cause.die(redactDefect(reason.defect, sensitive)), Context.makeUnsafe(reason.annotations)).reasons
				: [reason],
		),
	);

export const redactingErrorReporter = (
	reporter: ErrorReporter.ErrorReporter,
	sensitive: SensitiveKey = isSensitiveKey,
): ErrorReporter.ErrorReporter => ({
	[ErrorReporter.TypeId]: ErrorReporter.TypeId,
	report: (options) => reporter.report({ ...options, cause: redactCause(options.cause, sensitive) }),
});
