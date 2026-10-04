import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { quietOnClosedPipe } from "../src/cli/run-main.ts";

function failingWith(code: string): Writable {
	return new Writable({
		write: (_chunk, _encoding, callback) => callback(Object.assign(new Error(`write ${code}`), { code })),
	});
}

describe("an output stream whose reader went away", () => {
	it("swallows EPIPE, so quality --help | head ends quietly", async () => {
		const stream = failingWith("EPIPE");
		quietOnClosedPipe(stream);
		const failure = await new Promise((resolve) => stream.write("usage", resolve));
		expect(failure).toMatchObject({ code: "EPIPE" });
		expect(stream.destroyed).toBe(true);
	});

	it("still throws any other write error", () => {
		const stream = failingWith("EIO");
		quietOnClosedPipe(stream);
		const error = Object.assign(new Error("write EIO"), { code: "EIO" });
		expect(() => stream.emit("error", error)).toThrow(error);
	});
});
