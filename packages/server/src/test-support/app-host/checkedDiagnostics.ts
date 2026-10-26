import { Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { appHost } from "#appHost.ts";
import { host } from "./story.ts";

const minimum = Schema.isMinLength(1);
const maximum = Schema.isMaxLength(100);
const contacts = {
	filter: Schema.String.check(minimum).annotate({ sensitive: true }),
	group: Schema.String.check(minimum.and(maximum)).annotate({ sensitive: true }),
	nestedFilter: Schema.String.check(minimum.annotate({ sensitive: true }).and(maximum).and(maximum)),
	nestedGroup: Schema.String.check(minimum.and(maximum).annotate({ sensitive: true }).and(maximum)),
};

export function checkedDiagnostics(check: keyof typeof contacts) {
	return host.trait("configured", `a ${check} declares sensitive contact diagnostics`, (state) => {
		const fields = { contact: contacts[check], visible: Schema.String.check(minimum) };
		const group = RpcGroup.make(Rpc.make("diagnose", { error: Schema.Struct(fields), payload: fields, success: Schema.Void }));
		const handlers = group.toLayer({
			diagnose: (payload) =>
				Effect.gen(function* () {
					yield* Effect.logInfo("diagnostic").pipe(Effect.annotateLogs(payload));
					yield* Effect.annotateCurrentSpan(payload);
					return yield* Effect.fail(payload);
				}),
		});
		state.build = () => appHost({ config: state.config, group, handlers, policy: "loopback", services: Layer.empty });
	});
}
