import { Effect, Schema } from "effect";
import { McpClient, McpProtocol, McpSchema } from "effect/ai";
import { FetchHttpClient } from "effect/http";

export const connect = Effect.fnUntraced(function* (url: string, name: string) {
	return yield* McpClient.make({ name, version: "1" }).pipe(
		Effect.provideServiceEffect(McpClient.Transport, McpClient.http({ headers: { "x-story-caller": name }, protocol: McpProtocol.v2026_07_28, url })),
		Effect.provide(FetchHttpClient.layer),
	);
});

export function tool(name: string) {
	return new McpSchema.Tool({ inputSchema: { type: "object" }, name });
}

export function call(client: McpClient.McpClient, name: string) {
	return client
		.callTool({ schema: Schema.String, tool: tool(name) })
		.pipe(Effect.catchReason("McpClientError", "ProtocolError", (reason) => Effect.succeed(`refused: ${reason.description}`)));
}
