import { createServer } from "node:net";
import { Layer } from "effect";
import { otlpTracing } from "#otlpTracing.ts";
import { type HostState, io } from "#test/app-host/state.ts";
import { host } from "#test/app-host/story.ts";
import { otlpReceiver } from "#test/otlpReceiver.ts";

// The collector keeps its port: a closed one can go to the next listener, even this host, whose answer would be an HTTP status.
function droppingCollector() {
	const server = createServer((socket) => socket.resetAndDestroy());
	return new Promise<{ close: () => Promise<void>; url: string }>((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (address === null || typeof address === "string") {
				reject(new Error("Expected a TCP collector address"));
				return;
			}
			resolve({
				close: () => new Promise<void>((closed, failed) => server.close((error) => (error ? failed(error) : closed()))),
				url: `http://127.0.0.1:${address.port}`,
			});
		});
	});
}

interface CollectorOptions {
	answer?: string | null;
	drops?: boolean;
	endpoint?: "base" | "traces";
	env?: Record<string, string>;
	status?: number | ((attempt: number) => number | undefined);
}

async function collectorUrl(state: HostState, options: CollectorOptions, path: string) {
	if (options.drops) {
		const dropping = await droppingCollector();
		state.cleanup.push(dropping.close);
		return dropping.url;
	}
	const receiver = await otlpReceiver(options.status, options.answer, path);
	state.receiver = receiver;
	state.cleanup.push(receiver.close);
	return receiver.url;
}

export function collector(options: CollectorOptions = {}) {
	const description = options.drops ? "a loopback OTLP collector drops each connection unanswered" : "a loopback OTLP collector receives host traces";
	return host.trait("configured", description, (state) =>
		io(async () => {
			const path = options.endpoint === undefined ? "/v1/traces" : { base: "/base/v1/traces", traces: "/custom" }[options.endpoint];
			const url = await collectorUrl(state, options, path);
			Object.assign(state.env, { "OTEL_EXPORTER_OTLP_ENDPOINT": url }, options.env);
			if (options.endpoint === "base") {
				state.env.OTEL_EXPORTER_OTLP_ENDPOINT = `${url}/base/`;
			}
			if (options.endpoint === "traces") {
				state.env.OTEL_EXPORTER_OTLP_ENDPOINT = `${url}/ignored`;
				state.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = `${url}/custom`;
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
