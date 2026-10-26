import { Effect, ErrorReporter, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { appHost } from "#appHost.ts";
import { host } from "#test/app-host/story.ts";

const Field = Schema.Literals(["message", "name"]);
const Api = RpcGroup.make(
	Rpc.make("nestedErrors", {
		error: Schema.Defect(),
		payload: { field: Field, kind: Schema.Literals(["defect", "failure"]), value: Schema.String },
		success: Schema.Void,
	}),
);
function innerError(field: typeof Field.Type, value: string) {
	const error = new Error(field === "message" ? value : "inner public detail");
	if (field === "name") {
		Object.defineProperty(error, "name", { configurable: true, value, writable: true });
	}
	return error;
}
const handlers = Api.toLayer({
	nestedErrors: ({ field, kind, value }) =>
		Effect.gen(function* () {
			const inner = innerError(field, value);
			const enumerable = innerError(field, value);
			Object.defineProperty(enumerable, "stack", { enumerable: true });
			const error = Object.assign(new Error("outer public detail", { cause: inner }), { details: { errors: [inner, enumerable] } });
			const diagnostic = { errors: [error], failure: error, visible: "public diagnostic" };
			yield* Effect.logInfo("nested errors", diagnostic).pipe(Effect.annotateLogs({ diagnostic }));
			yield* Effect.annotateCurrentSpan({ diagnostic });
			return yield* kind === "defect" ? Effect.die(error) : Effect.fail(error);
		}),
});

export function nestedErrors(field: typeof Field.Type) {
	return host.trait("configured", `nested Error ${field} fields are sensitive`, (state) => {
		state.config.sensitiveKeys = [field];
		state.build = () =>
			appHost({ config: state.config, group: Api, handlers, policy: "loopback" }).pipe(
				Layer.provide(ErrorReporter.layer([{ [ErrorReporter.TypeId]: ErrorReporter.TypeId, report: ({ cause }) => state.reported.push(cause) }])),
			);
	});
}
