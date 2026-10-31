import { Clock, Context, Effect, ErrorReporter, Exit, Layer, Logger, Option, References, Tracer } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { RedactionPolicy, redactionForRpc } from "#RedactionPolicy.ts";

// Railway's receiver accepts traces only, so diagnostics use the same span exporter.
export const traceDiagnostics = Layer.unwrap(
	Effect.gen(function* () {
		const tracer = yield* Tracer.Tracer;
		const clock = yield* Clock.Clock;
		const policy = yield* RedactionPolicy;
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
			const sensitive = redactionForRpc(policy, annotations["rpc.method"]);
			entry.event("log", timestamp, {
				...annotations,
				"log.message": redact(options.message, sensitive),
				"log.severity": options.logLevel,
			});
			entry.end(timestamp, options.cause.reasons.length === 0 ? Exit.void : Exit.failCause(options.cause));
		});
		const reporter = ErrorReporter.make(({ attributes, cause, fiber, severity, timestamp }) => {
			const entry = span("effect.error", fiber, timestamp);
			for (const [key, value] of Object.entries({ ...fiber.getRef(References.CurrentLogAnnotations), ...attributes, "error.severity": severity })) {
				entry.attribute(key, value);
			}
			entry.end(timestamp, Exit.failCause(cause));
		});
		return Layer.merge(Logger.layer([logger], { mergeWithExisting: true }), ErrorReporter.layer([reporter], { mergeWithExisting: true }));
	}),
);
