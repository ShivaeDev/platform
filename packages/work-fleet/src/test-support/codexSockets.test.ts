import { createServer } from "node:http";
import { PassThrough } from "node:stream";
import { expect, it } from "vitest";
import { codexSockets } from "./codexSockets.ts";

it.each(["ECONNRESET", "EPIPE"])("closes synthetic provider sockets after expected peer disconnect %s", async (code) => {
	const lifecycle = codexSockets(createServer());
	const socket = new PassThrough();
	lifecycle.add(socket);
	socket.emit("error", Object.assign(new Error("Peer exited"), { code }));
	await lifecycle.close();
	expect(lifecycle.sockets.size).toBe(0);
});

it("fails fixture cleanup for unexpected socket errors", async () => {
	const lifecycle = codexSockets(createServer());
	const socket = new PassThrough();
	lifecycle.add(socket);
	const error = Object.assign(new Error("Unexpected transport failure"), { code: "EOTHER" });
	socket.emit("error", error);
	await expect(lifecycle.close()).rejects.toMatchObject({ errors: [error] });
	expect(lifecycle.sockets.size).toBe(0);
});
