import { expect, it } from "vitest";
import { answersTo, documentAt, query } from "#boardTools.ts";
import { success as exit } from "#test/rpcReplies.ts";

it("matches answers to requests and names what the Board could not read", () => {
	const missing = JSON.stringify({ _tag: "Exit", exit: { _tag: "Failure", cause: [{ error: { message: "No such item." } }] }, requestId: "2" });
	const requests = [query("inbox"), documentAt("/_board/item/task%20b/")];
	expect(answersTo([query("inbox")], exit("1", "ok"), "/repo")).toEqual(["ok"]);
	expect(() => answersTo(requests, `${exit("1", "ok")}\n${missing}`, "/repo")).toThrow(
		"The Work Board for /repo could not read item task b: No such item.",
	);
	expect(() => answersTo(requests, exit("1", "ok"), "/repo")).toThrow("The Work Board for /repo sent no answer for work-board.document.");
	expect(() => answersTo(requests, "", "/repo")).toThrow("The Work Board for /repo did not answer with its RPC stream.");
});
