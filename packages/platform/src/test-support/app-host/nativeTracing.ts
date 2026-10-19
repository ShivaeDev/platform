import { Layer, Tracer } from "effect";
import { host } from "./story.ts";

export const nativeTracing = host.trait("configured", "a native tracer retains application span values", (state) => {
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			state.nativeSpans.push(span);
			return span;
		},
	});
	const build = state.build;
	state.build = () => build(state).pipe(Layer.provide(Layer.succeed(Tracer.Tracer, tracer)));
});
