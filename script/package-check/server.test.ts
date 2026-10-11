import assert from "node:assert/strict";
import process from "node:process";
import { test as it } from "node:test";
import { Effect } from "effect";
import cases from "./bin-cases.json" with { type: "json" };
import { checkServer } from "./server.ts";

it("the packed Board check rejects unrelated JavaScript with a session export", async () => {
	const path = "/_board/native.js";
	const expected = cases["work-board"].pages[path];
	const body = "const unrelated = true; export { unrelated as session };";
	const server = `
import { createServer } from "node:http";
const server = createServer((request, response) => {
	response.writeHead(request.url === ${JSON.stringify(path)} ? 200 : 404, { "content-type": "text/javascript" });
	response.end(${JSON.stringify(body)});
});
server.listen(0, "127.0.0.1", () => console.log("http://127.0.0.1:" + server.address().port));
`;
	await assert.rejects(
		Effect.runPromise(checkServer(process.cwd(), process.execPath, ["--input-type=module", "--eval", server], { [path]: expected })),
		/Packed server request failed: \/_board\/native\.js/u,
	);
});
