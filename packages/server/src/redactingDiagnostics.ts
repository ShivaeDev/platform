import { Context, Effect, ErrorReporter, Layer, Logger, References } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { redactDiagnosticCause, redactingErrorReporter } from "@shivaedev/errors/redactCause.ts";
import type { SensitiveKey } from "@shivaedev/errors/sensitive.ts";
import { type HostRedactionPolicy, redactionForRpc } from "#RedactionPolicy.ts";

export function redactRecord(values: Readonly<Record<string, unknown>>, sensitive: SensitiveKey): Record<string, unknown> {
	return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, sensitive(key) ? "<redacted>" : redact(value, sensitive)]));
}
function requestErrorReporter(reporter: ErrorReporter.ErrorReporter, policy: HostRedactionPolicy): ErrorReporter.ErrorReporter {
	return {
		[ErrorReporter.TypeId]: ErrorReporter.TypeId,
		report: (options) => {
			const sensitive = redactionForRpc(policy, options.fiber.getRef(References.CurrentLogAnnotations)["rpc.method"]);
			return redactingErrorReporter(reporter, sensitive).report(options);
		},
	};
}
export function redactingDiagnostics(policy: HostRedactionPolicy) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const loggers = yield* Logger.CurrentLoggers;
			const reporters = yield* ErrorReporter.CurrentErrorReporters;
			const safeLoggers = new Set(
				[...loggers].map((logger) =>
					Logger.make((options) => {
						const context = options.fiber.context;
						const raw = options.fiber.getRef(References.CurrentLogAnnotations);
						const sensitive = redactionForRpc(policy, raw["rpc.method"]);
						const annotations = redactRecord(raw, sensitive);
						options.fiber.setContext(Context.add(context, References.CurrentLogAnnotations, annotations));
						try {
							return logger.log({ ...options, cause: redactDiagnosticCause(options.cause, sensitive), message: redact(options.message, sensitive) });
						} finally {
							options.fiber.setContext(context);
						}
					}),
				),
			);
			return Context.make(Logger.CurrentLoggers, safeLoggers).pipe(
				Context.add(ErrorReporter.CurrentErrorReporters, new Set([...reporters].map((reporter) => requestErrorReporter(reporter, policy)))),
			);
		}),
	);
}
