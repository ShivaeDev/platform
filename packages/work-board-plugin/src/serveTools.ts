import type { EngineInterface, On } from "claude-code";
import { type Board, item, needsYou, overview } from "./boardTools.ts";
import { connect } from "./connect.ts";
import { text } from "./rpc.ts";

async function answer($: EngineInterface, read: (board: Board) => Promise<unknown>) {
	try {
		return { result: JSON.stringify(await read(await connect($))) };
	} catch (error) {
		return { deny: error instanceof Error ? error.message : String(error) };
	}
}

export function serveTools(on: On): void {
	on("tool.call", { tool: "mcp__workboard__board_overview" }, ($) => answer($, overview));
	on("tool.call", { tool: "mcp__workboard__needs_you" }, ($) => answer($, needsYou));
	on("tool.call", { tool: "mcp__workboard__item" }, ($, e) => {
		const id = text(e.id);
		if (id === undefined) {
			return { deny: "item needs the id of a Work Board item, such as task.first." };
		}
		return answer($, (board) => item(board, id));
	});
}
