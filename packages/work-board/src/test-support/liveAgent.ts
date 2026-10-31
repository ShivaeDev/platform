import { Effect, Schema, type Scope } from "effect";
import { mcpClient, toolValue } from "./mcpClient.ts";

const Listing = Schema.Struct({
	tools: Schema.Array(
		Schema.Struct({ annotations: Schema.optional(Schema.Struct({ readOnlyHint: Schema.optional(Schema.Boolean) })), name: Schema.String }),
	),
});

export type Agent = Effect.Success<ReturnType<typeof mcpClient>>;

export interface AgentConnection {
	agent?: Agent;
	readonly root: string;
}

export const agentOf = Effect.fn("Test.agentOf")(function* (connection: AgentConnection): Effect.fn.Return<Agent, unknown, Scope.Scope> {
	connection.agent ??= yield* mcpClient(connection.root);
	return connection.agent;
});

export const agentTools = Effect.fn("Test.agentTools")(function* (connection: AgentConnection) {
	const listing = Schema.decodeUnknownSync(Listing)(yield* (yield* agentOf(connection)).list());
	return listing.tools
		.map((tool) => ({ name: tool.name, readOnly: tool.annotations?.readOnlyHint === true }))
		.sort((left, right) => left.name.localeCompare(right.name));
});

export const agentReads = Effect.fn("Test.agentReads")(function* (connection: AgentConnection, tool: string, args: Record<string, unknown>) {
	const result = yield* (yield* agentOf(connection)).call(tool, args);
	if (result.isError === true) {
		return `error: ${result.content
			.map((entry) => entry.text)
			.join("")
			.replaceAll(connection.root, "the project folder")}`;
	}
	return toolValue(result);
});
