#!/usr/bin/env node
import process from "node:process";

const action = process.argv[2];
if (action === "wait" || action === "response" || action === "question") {
	try {
		const entry: typeof import("#server/responses/agent-cli.ts") = await import(new URL("../../assets/agent.js", import.meta.url).href);
		await entry.runAgent(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`${String(error)}\n`);
		process.exitCode ??= 1;
	}
} else {
	const entry = await import("./serve-cli.ts");
	entry.runServe();
}
