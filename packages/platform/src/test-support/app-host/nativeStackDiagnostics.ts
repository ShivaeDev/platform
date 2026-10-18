import { Cause, Context, Effect, ErrorReporter, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { appHost } from "#server/appHost.ts";
import { host } from "./story.ts";

const Note = Context.Service<string>("publicReasonNote");
const group = RpcGroup.make(
	Rpc.make("nativeStack", { payload: { kind: Schema.Literals(["defect", "interruption"]), marker: Schema.String }, success: Schema.Void }),
);
const handlers = group.toLayer({
	nativeStack: ({ kind, marker }) => {
		const frame = { name: marker, parent: undefined, stack: () => `Error\n    at ${marker} (/private/native-stack.ts:1:1)` };
		const annotations = Context.make(Cause.StackTrace, frame).pipe(
			Context.add(Cause.InterruptorStackTrace, frame),
			Context.add(Note, "public reason detail"),
		);
		const cause = kind === "defect" ? Cause.die("public defect") : Cause.combine(Cause.die("public defect"), Cause.interrupt(123));
		return Effect.failCause(Cause.annotate(cause, annotations));
	},
});

export const nativeStackDiagnostics = host.trait("configured", "native cause stack metadata is sensitive", (state) => {
	state.config.sensitiveKeys = ["stack"];
	state.build = () =>
		appHost({ config: state.config, group, handlers, policy: "loopback", services: Layer.empty }).pipe(
			Layer.provide(ErrorReporter.layer([{ [ErrorReporter.TypeId]: ErrorReporter.TypeId, report: ({ cause }) => state.reported.push(cause) }])),
		);
});
