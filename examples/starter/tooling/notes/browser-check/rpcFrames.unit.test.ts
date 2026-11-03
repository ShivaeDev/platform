import { expect, it } from "vitest";
import { rpcHint, rpcListRequest } from "./rpcFrames.ts";

for (const tag of ["Resync", "Changed"] as const) {
	const hint = tag === "Resync" ? { _tag: tag } : { _tag: tag, keys: [] };
	it(`${tag} verifies a live hint only inside an RPC chunk`, () => {
		expect(rpcHint(JSON.stringify({ _tag: "Chunk", requestId: "live", values: [hint] }), tag)).toBe(true);
		expect(rpcHint(JSON.stringify(hint), tag)).toBe(false);
		expect(rpcHint(JSON.stringify({ _tag: "Chunk", requestId: "live", values: [{ _tag: "Other" }] }), tag)).toBe(false);
	});
}

it("only a notes.list RPC request verifies the list reread", () => {
	expect(rpcListRequest(JSON.stringify({ _tag: "Request", headers: [], id: "list", payload: {}, tag: "notes.list" }))).toBe(true);
	expect(rpcListRequest(JSON.stringify({ message: "notes.list" }))).toBe(false);
	expect(rpcListRequest(JSON.stringify({ _tag: "Request", headers: [], id: "list", payload: {}, tag: "notes.get" }))).toBe(false);
});
