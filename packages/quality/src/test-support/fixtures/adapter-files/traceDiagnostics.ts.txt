import { Clock, Context, Effect, ErrorReporter, Exit, Layer, Logger, Option, References, Tracer } from "effect";
import { redact, redactRecord } from "@shivaedev/errors/redact.ts";
import { RedactionPolicy, redactionForRpc } from "#RedactionPolicy.ts";

// Railway's receiver accepts traces only, so diagnostics use the same span exporter.
export const traceDiagnostics = Layer.unwrap(
	Effect.gen(function* () {
		const tracer = yield* Tracer.Tracer;
		const clock = yield* Clock.Clock;
		const policy = yield* RedactionPolicy;
		// Request values can repeat sensitive error fields under otherwise public payload keys.
		function exportPolicy(fiber: Logger.Options<unknown>["fiber"]) {
			const sensitive = redactionForRpc(policy, fiber.getRef(References.CurrentLogAnnotations)["rpc.method"]);
			return (key: string) => key === "rpc.payload" || sensitive(key);
		}
		function span(name: string, fiber: Logger.Options<unknown>["fiber"], timestamp: bigint) {
			return tracer.span({
				annotations: Context.empty(),
				kind: "internal",
				links: [],
				name,
				parent: Option.fromUndefinedOr(fiber.cache.span),
				root: false,
				sampled: true,
				startTime: timestamp,
			});
		}
		const logger = Logger.make((options) => {
			const timestamp = clock.currentTimeNanosUnsafe();
			const entry = span("effect.log", options.fiber, timestamp);
			const annotations = options.fiber.getRef(References.CurrentLogAnnotations);
			const sensitive = exportPolicy(options.fiber);
			entry.event("log", timestamp, {
				...redactRecord(annotations, sensitive),
				"log.message": redact(options.message, sensitive),
				"log.severity": options.logLevel,
			});
			entry.end(timestamp, options.cause.reasons.length === 0 ? Exit.void : Exit.failCause(options.cause));
		});
		const reporter = ErrorReporter.make(({ attributes, cause, fiber, severity, timestamp }) => {
			const entry = span("effect.error", fiber, timestamp);
			for (const [key, value] of Object.entries(
				redactRecord({ ...fiber.getRef(References.CurrentLogAnnotations), ...attributes, "error.severity": severity }, exportPolicy(fiber)),
			)) {
				entry.attribute(key, value);
			}
			entry.end(timestamp, Exit.failCause(cause));
		});
		return Layer.merge(Logger.layer([logger], { mergeWithExisting: true }), ErrorReporter.layer([reporter], { mergeWithExisting: true }));
	}),
);
