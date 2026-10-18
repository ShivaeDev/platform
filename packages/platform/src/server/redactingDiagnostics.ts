import { Context, Effect, ErrorReporter, Layer, Logger, References } from "effect";
import { redact } from "#server/rpc-server/redact.ts";
import { redactDiagnosticCause, redactingErrorReporter } from "#server/rpc-server/redactCause.ts";
import type { SensitiveKey } from "#server/rpc-server/sensitive.ts";

export function redactRecord(values: Readonly<Record<string, unknown>>, sensitive: SensitiveKey): Record<string, unknown> {
	return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, sensitive(key) ? "<redacted>" : redact(value, sensitive)]));
}
export function redactingDiagnostics(sensitive: SensitiveKey) {
	return Layer.effectContext(
		Effect.gen(function* () {
			const loggers = yield* Logger.CurrentLoggers;
			const reporters = yield* ErrorReporter.CurrentErrorReporters;
			const safeLoggers = new Set(
				[...loggers].map((logger) =>
					Logger.make((options) => {
						const context = options.fiber.context;
						const annotations = redactRecord(options.fiber.getRef(References.CurrentLogAnnotations), sensitive);
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
				Context.add(ErrorReporter.CurrentErrorReporters, new Set([...reporters].map((reporter) => redactingErrorReporter(reporter, sensitive)))),
			);
		}),
	);
}
