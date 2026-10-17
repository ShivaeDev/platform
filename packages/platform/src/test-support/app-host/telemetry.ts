import { Layer } from "effect";
import { otlpTracing } from "#otlpTracing.ts";
import { otlpReceiver } from "#test/otlpReceiver.ts";
import { io } from "./state.ts";
import { host } from "./story.ts";

export function collector(
	options: {
		status?: number | ((attempt: number) => number);
		offline?: boolean;
		answer?: string;
		env?: Record<string, string>;
		endpoint?: "base" | "traces";
	} = {},
) {
	return host.trait("configured", "a loopback OTLP collector receives host traces", (state) =>
		io(async () => {
			const receiver = await otlpReceiver(options.status, options.answer);
			state.receiver = receiver;
			if (options.offline) {
				await receiver.close();
			} else {
				state.cleanup.push(receiver.close);
			}
			Object.assign(state.env, { "OTEL_EXPORTER_OTLP_ENDPOINT": receiver.url }, options.env);
			if (options.endpoint === "base") {
				state.env.OTEL_EXPORTER_OTLP_ENDPOINT = `${receiver.url}/base/`;
			}
			if (options.endpoint === "traces") {
				state.env.OTEL_EXPORTER_OTLP_ENDPOINT = `${receiver.url}/ignored`;
				state.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = `${receiver.url}/custom`;
			}
		}),
	);
}
export function flushable() {
	return host.trait("configured", "the exporter can flush between host requests", (state) => {
		const build = state.build;
		state.build = () => Layer.merge(build(state), otlpTracing);
	});
}
