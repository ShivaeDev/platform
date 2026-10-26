import { Effect, ErrorReporter, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { appHost } from "#appHost.ts";
import { host } from "./story.ts";

const Field = Schema.Literals(["cause", "message", "name", "stack"]);
const Api = RpcGroup.make(
	Rpc.make("errorField", {
		error: Schema.Defect(),
		payload: { field: Field, kind: Schema.Literals(["defect", "failure"]), value: Schema.String },
		success: Schema.Void,
	}),
);
const handlers = Api.toLayer({
	errorField: ({ field, kind, value }) => {
		const error = new Error(field === "message" ? value : "public detail", field === "cause" ? { cause: value } : undefined);
		if (field === "name" || field === "stack") {
			Object.defineProperty(error, field, { configurable: true, value, writable: true });
		}
		return kind === "defect" ? Effect.die(error) : Effect.fail(error);
	},
});

export function sensitiveErrorField(field: typeof Field.Type) {
	return host.trait("configured", `the host marks the Error ${field} field as sensitive`, (state) => {
		state.config.sensitiveKeys = [field];
		state.build = () =>
			appHost({ config: state.config, group: Api, handlers, policy: "loopback" }).pipe(
				Layer.provide(ErrorReporter.layer([{ [ErrorReporter.TypeId]: ErrorReporter.TypeId, report: ({ cause }) => state.reported.push(cause) }])),
			);
	});
}
