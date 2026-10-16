import { Layer, Schema } from "effect";
import { McpServer, Tool, Toolkit } from "effect/ai";
import { BoardToolError, readBoard } from "./client.ts";
import { item, needsYou, overview } from "./queries.ts";
import { Item, NeedsYou, Overview } from "./schema.ts";

const result = { failure: BoardToolError };
const tools = Toolkit.make(
	Tool.make("board_overview", {
		...result,
		description: "Read needs-you items and count, in-flight Fleet stages and PRs, and goal progress counts.",
		success: Overview,
	}).annotate(Tool.Readonly, true),
	Tool.make("needs_you", {
		...result,
		description: "Read the board's you lane with reason, age in milliseconds since source modification, and options.",
		success: NeedsYou,
	}).annotate(Tool.Readonly, true),
	Tool.make("item", {
		...result,
		description: "Read an item's computed status, owner, criteria, relationships, Fleet stage and open decisions.",
		parameters: Schema.Struct({ id: Schema.String }),
		success: Item,
	}).annotate(Tool.Readonly, true),
);

export function mcpTools(directory: string) {
	return McpServer.toolkit(tools).pipe(
		Layer.provide(
			tools.toLayer({
				"board_overview": () => readBoard(directory, overview),
				item: ({ id }) => readBoard(directory, (client) => item(client, id)),
				"needs_you": () => readBoard(directory, needsYou),
			}),
		),
	);
}
