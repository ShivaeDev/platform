import { Cause, Context, ErrorReporter, Predicate, type References } from "effect";
import { redact } from "#redact.ts";
import { isSensitiveKey, REDACTED, redactErrorStack, redactText, type SensitiveKey } from "#sensitive.ts";

function reporterHints(error: Error, sensitive: SensitiveKey) {
	return {
		...(ErrorReporter.isIgnored(error) ? { [ErrorReporter.ignore]: true } : {}),
		...(ErrorReporter.severity in error ? { [ErrorReporter.severity]: ErrorReporter.getSeverity(error) } : {}),
		...(ErrorReporter.attributes in error ? { [ErrorReporter.attributes]: redact(ErrorReporter.getAttributes(error), sensitive) } : {}),
	};
}
function errorText(key: string, value: string, sensitive: SensitiveKey): string {
	return sensitive(key) ? REDACTED : redactText(value, sensitive);
}
function redactError(error: Error, sensitive: SensitiveKey): Error {
	const cause = sensitive("cause") ? REDACTED : redact(error.cause, sensitive);
	const options = error.cause === undefined ? undefined : { cause };
	const copy = Object.assign(
		new Error(errorText("message", error.message, sensitive), options),
		redact(Object.fromEntries(Object.entries(error)), sensitive),
		reporterHints(error, sensitive),
	);
	Object.defineProperty(copy, "name", { configurable: true, value: errorText("name", error.name, sensitive), writable: true });
	Object.defineProperty(copy, "stack", {
		configurable: true,
		value: redactErrorStack(error, sensitive),
		writable: true,
	});
	return copy;
}
export function redactDefect(defect: unknown, sensitive: SensitiveKey = isSensitiveKey): unknown {
	return Predicate.isError(defect) ? redactError(defect, sensitive) : redact(defect, sensitive);
}
export function redactCause<E>(cause: Cause.Cause<E>, sensitive: SensitiveKey = isSensitiveKey): Cause.Cause<E> {
	return Cause.fromReasons(
		cause.reasons.flatMap<Cause.Reason<E>>((reason) =>
			Cause.isDieReason(reason)
				? Cause.annotate(Cause.die(redactDefect(reason.defect, sensitive)), Context.makeUnsafe(reason.annotations)).reasons
				: [reason],
		),
	);
}
function diagnosticReason(reason: Cause.Reason<unknown>, sensitive: SensitiveKey): Cause.Cause<unknown> {
	switch (reason._tag) {
		case "Fail":
			return Cause.fail(redactDefect(reason.error, sensitive));
		case "Die":
			return Cause.die(redactDefect(reason.defect, sensitive));
		case "Interrupt":
			return Cause.interrupt(reason.fiberId);
	}
}
function stackFrame(frame: References.StackFrame | undefined, sensitive: SensitiveKey, remaining = 8): References.StackFrame | undefined {
	if (frame === undefined || remaining === 0) {
		return undefined;
	}
	return {
		name: sensitive("name") ? REDACTED : redactText(frame.name, sensitive),
		parent: stackFrame(frame.parent, sensitive, remaining - 1),
		stack: () => {
			const value = frame.stack();
			if (value === undefined) {
				return undefined;
			}
			return sensitive("name") || sensitive("message") ? REDACTED : redactText(value, sensitive);
		},
	};
}
function diagnosticAnnotations(reason: Cause.Reason<unknown>, sensitive: SensitiveKey) {
	const nativeStacks: Context.Key<Cause.StackTrace | Cause.InterruptorStackTrace, References.StackFrame>[] = [
		Cause.StackTrace,
		Cause.InterruptorStackTrace,
	];
	const annotations = new Map(
		[...reason.annotations]
			.filter(([key]) => !nativeStacks.some((service) => service.key === key))
			.map(([key, value]) => [key, sensitive(key) ? REDACTED : redact(value, sensitive)]),
	);
	if (!sensitive("stack")) {
		const context = Cause.reasonAnnotations(reason);
		for (const service of nativeStacks) {
			const frame = Context.getOrUndefined(context, service);
			if (frame !== undefined && !sensitive(service.key)) {
				annotations.set(service.key, stackFrame(frame, sensitive));
			}
		}
	}
	return annotations;
}
export function redactDiagnosticCause(cause: Cause.Cause<unknown>, sensitive: SensitiveKey = isSensitiveKey): Cause.Cause<unknown> {
	return Cause.fromReasons(
		cause.reasons.flatMap((reason) => {
			const redacted = diagnosticReason(reason, sensitive);
			const annotations = diagnosticAnnotations(reason, sensitive);
			return Cause.annotate(redacted, Context.makeUnsafe(annotations), { overwrite: true }).reasons;
		}),
	);
}
export function redactingErrorReporter(reporter: ErrorReporter.ErrorReporter, sensitive: SensitiveKey = isSensitiveKey): ErrorReporter.ErrorReporter {
	return {
		[ErrorReporter.TypeId]: ErrorReporter.TypeId,
		report: (options) => reporter.report({ ...options, cause: redactDiagnosticCause(options.cause, sensitive) }),
	};
}
