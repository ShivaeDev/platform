import process from "node:process";
import { createInterface } from "node:readline";

const input = createInterface({ input: process.stdin });
input.on("line", (line) => {
	const frame: { id?: number; method?: string; params?: { clientUserMessageId?: string } } = JSON.parse(line);
	let result: unknown;
	switch (frame.method ?? "") {
		case "initialize":
			result = { userAgent: "codex/different-version linux" };
			break;
		case "thread/start":
			result = { thread: { id: "stdio-thread" } };
			break;
		case "turn/start":
			result = { turn: { id: "stdio-turn", status: "inProgress" } };
			break;
		case "thread/items/list":
			result = { data: [{ item: { id: "answer", text: "ready ✓", type: "agentMessage" } }], nextCursor: null };
			break;
		default:
			return;
	}
	const reply = JSON.stringify({ id: frame.id, result });
	const split = reply.indexOf("result");
	process.stdout.write(reply.slice(0, split));
	process.stdout.write(`${reply.slice(split)}\n`);
});
