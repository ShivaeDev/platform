import { Layer } from "effect";
import { McpProtocol, McpServer } from "effect/ai";

export interface StdioOptions<E, R> {
	readonly name: string;
	readonly tools: Layer.Layer<never, E, R>;
	readonly version: string;
}

export function mcpStdio<E, R>(options: StdioOptions<E, R>) {
	return options.tools.pipe(
		Layer.provide(
			McpServer.layerStdio({
				name: options.name,
				protocols: [McpProtocol.v2026_07_28, McpProtocol.v2025_11_25],
				version: options.version,
			}),
		),
	);
}
