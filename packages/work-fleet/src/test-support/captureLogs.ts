import { Cause, Logger, References } from "effect";

export function captureLogs() {
	const entries: {
		readonly annotations: Readonly<Record<string, unknown>>;
		readonly cause: string;
		readonly level: string;
		readonly message: unknown;
	}[] = [];
	const logger = Logger.make((options) => {
		entries.push({
			annotations: options.fiber.getRef(References.CurrentLogAnnotations),
			cause: Cause.pretty(options.cause),
			level: options.logLevel,
			message: options.message,
		});
	});
	return { entries, layer: Logger.layer([logger]) };
}
