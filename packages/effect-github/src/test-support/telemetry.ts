import { Layer, Logger, References, Tracer } from "effect";

export function telemetry() {
	const logs: { readonly annotations: Readonly<Record<string, unknown>>; readonly message: unknown }[] = [];
	const spans: Tracer.NativeSpan[] = [];
	const logger = Logger.make(({ fiber, message }) => {
		logs.push({ annotations: fiber.getRef(References.CurrentLogAnnotations), message });
	});
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			spans.push(span);
			return span;
		},
	});
	return {
		layer: Layer.mergeAll(Logger.layer([logger]), Layer.succeed(Tracer.Tracer, tracer), Layer.succeed(References.MinimumLogLevel, "All")),
		logs,
		spans,
	};
}
