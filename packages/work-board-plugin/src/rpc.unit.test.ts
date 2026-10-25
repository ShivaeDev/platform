import { expect, it } from "vitest";
import { readExits } from "#rpc.ts";
import { failure, success } from "#test/rpcReplies.ts";

it("reads each exit by request id and names a failure by its error message or tag", () => {
	const exits = readExits(
		[
			"not json",
			success("2", "two"),
			failure("1", { _tag: "NotFound", message: "The document is missing." }),
			failure("3", {}),
			success("0", "x"),
		].join("\n"),
	);
	expect([...exits.entries()]).toEqual([
		[1, { value: "two" }],
		[0, { failure: "The document is missing." }],
		[2, { failure: "Fail" }],
	]);
});
