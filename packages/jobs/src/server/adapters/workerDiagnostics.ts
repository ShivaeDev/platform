import { Context, Effect, Logger, References } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { redactDiagnosticCause } from "@shivaedev/errors/redactCause.ts";
import { isSensitiveKey, REDACTED } from "@shivaedev/errors/sensitive.ts";

function maskedLogger(logger: Logger.Logger<unknown, unknown>) {
	return Logger.make((options) => {
		const context = options.fiber.context;
		const annotations = Object.fromEntries(
			Object.entries(options.fiber.getRef(References.CurrentLogAnnotations)).map(([key, value]) => [
				key,
				isSensitiveKey(key) ? REDACTED : redact(value),
			]),
		);
		options.fiber.setContext(Context.add(context, References.CurrentLogAnnotations, annotations));
		try {
			return logger.log({ ...options, cause: redactDiagnosticCause(options.cause), message: redact(options.message) });
		} finally {
			options.fiber.setContext(context);
		}
	});
}

export function workerDiagnostics<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.flatMap(Logger.CurrentLoggers, (loggers) =>
		Effect.provideService(effect, Logger.CurrentLoggers, new Set([...loggers].map(maskedLogger))),
	);
}
