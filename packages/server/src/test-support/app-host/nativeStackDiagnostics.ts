import { Cause, Context, Effect, ErrorReporter, Layer, type References, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { appHost } from "#appHost.ts";
import { host } from "./story.ts";

const Note = Context.Service<string>("publicReasonNote");
const group = RpcGroup.make(
	Rpc.make("nativeStack", {
		payload: {
			depth: Schema.optional(Schema.Number),
			fiberId: Schema.optional(Schema.Number),
			kind: Schema.Literals(["defect", "interruption"]),
			marker: Schema.String,
		},
		success: Schema.Void,
	}),
);
const handlers = group.toLayer({
	nativeStack: ({ depth = 1, fiberId = 123, kind, marker }) => {
		let frame: References.StackFrame = {
			name: `${marker}-0`,
			parent: undefined,
			stack: () => `Error\n    at ${marker}-0 (/app/native-stack.ts:1:1)`,
		};
		for (let index = 1; index < depth; index += 1) {
			const name = `${marker}-${index}`;
			frame = { name, parent: frame, stack: () => `Error\n    at ${name} (/app/native-stack.ts:${index + 1}:1)` };
		}
		const annotations = Context.make(Cause.StackTrace, frame).pipe(
			Context.add(Cause.InterruptorStackTrace, frame),
			Context.add(Note, "public reason detail"),
		);
		const cause = kind === "defect" ? Cause.die("public defect") : Cause.combine(Cause.die("public defect"), Cause.interrupt(fiberId));
		return Effect.failCause(Cause.annotate(cause, annotations));
	},
});

function diagnostics(keys: readonly string[]) {
	return host.trait("configured", keys.length === 0 ? "native cause stacks are public" : "native cause stack metadata is sensitive", (state) => {
		state.config.sensitiveKeys = keys;
		state.build = () =>
			appHost({ config: state.config, group, handlers, policy: "loopback", services: Layer.empty }).pipe(
				Layer.provide(ErrorReporter.layer([{ [ErrorReporter.TypeId]: ErrorReporter.TypeId, report: ({ cause }) => state.reported.push(cause) }])),
			);
	});
}
export const nativeStackDiagnostics = diagnostics(["stack"]);
export const publicStackDiagnostics = diagnostics([]);
