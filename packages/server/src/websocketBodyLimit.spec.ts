import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { echoRpc, largestAcceptedMessage, message, oversizedBatch } from "#test/app-host/body.ts";
import { socketBody } from "#test/app-host/socketBody.ts";
import { configuration, environment } from "#test/app-host/story.ts";

for (const { config, env, limit, name } of [
	{ config: {}, env: {}, limit: 1024 * 1024, name: "the default" },
	{ config: {}, env: { "MAX_BODY_SIZE": "256" }, limit: 256, name: "MAX_BODY_SIZE" },
	{ config: { maxBodySize: 128 }, env: { "MAX_BODY_SIZE": "256" }, limit: 128, name: "the config override" },
	{ config: { maxBodySize: 2 * 1024 * 1024 }, env: {}, limit: 2 * 1024 * 1024, name: "a raised limit" },
]) {
	for (const binary of [false, true]) {
		const encoding = binary ? "binary" : "text";
		socketBody.it(
			`an oversized ${encoding} message under ${name} closes with a typed size reason before any handler runs`,
			[echoRpc, configuration(config), environment(env)],
			function* ({ handledCalls, openSocket, sendSocketMessage, socketAnswer }) {
				yield* openSocket();
				const body = oversizedBatch(limit);
				yield* sendSocketMessage(binary ? Buffer.from(body) : body);

				yield* outcomes([
					[
						"socket closure",
						() => socketAnswer(),
						expect.objectContaining({ code: 1009, connection: "closed", error: "SocketError", reason: "SocketCloseError" }),
					],
					["handled calls", () => handledCalls(), []],
				]);
			},
		);
		socketBody.it(
			`a ${encoding} message filling ${name} works and the connection accepts another message`,
			[echoRpc, configuration(config), environment(env)],
			function* ({ handledCalls, openSocket, sendSocketMessage, socketAnswer }) {
				yield* openSocket();
				const accepted = largestAcceptedMessage(limit);
				yield* sendSocketMessage(binary ? Buffer.from(accepted.body) : accepted.body);
				expect(yield* socketAnswer()).toMatchObject({ body: expect.stringContaining("accepted"), connection: "open" });
				yield* sendSocketMessage(message("another", "2"));
				yield* outcomes([
					["RPC answer", () => socketAnswer(), expect.objectContaining({ body: expect.stringContaining("accepted"), connection: "open" })],
					["handled calls", () => handledCalls(), [accepted.text, "another"]],
				]);
			},
		);
	}
}

socketBody.it(
	"a UTF-8 message one byte over the limit closes before its handler runs",
	[echoRpc, configuration({ maxBodySize: 128 })],
	function* ({ handledCalls, openSocket, sendSocketMessage, socketAnswer }) {
		yield* openSocket();
		yield* sendSocketMessage(largestAcceptedMessage(129).body);

		yield* outcomes([
			[
				"socket closure",
				() => socketAnswer(),
				expect.objectContaining({ code: 1009, connection: "closed", error: "SocketError", reason: "SocketCloseError" }),
			],
			["handled calls", () => handledCalls(), []],
		]);
	},
);

socketBody.it(
	"continuation frames cannot split an oversized message around the limit",
	[echoRpc, configuration({ maxBodySize: 128 })],
	function* ({ handledCalls, openSocket, sendSocketFragments, socketAnswer }) {
		yield* openSocket();
		const body = message("é".repeat(50));
		yield* sendSocketFragments([body.slice(0, 80), body.slice(80)]);

		yield* outcomes([
			[
				"socket closure",
				() => socketAnswer(),
				expect.objectContaining({ code: 1009, connection: "closed", error: "SocketError", reason: "SocketCloseError" }),
			],
			["handled calls", () => handledCalls(), []],
		]);
	},
);

socketBody.it(
	"continuation frames filling the limit reach the RPC handler",
	[echoRpc, configuration({ maxBodySize: 128 })],
	function* ({ handledCalls, openSocket, sendSocketFragments, socketAnswer }) {
		yield* openSocket();
		const accepted = largestAcceptedMessage(128);
		yield* sendSocketFragments([accepted.body.slice(0, 80), accepted.body.slice(80)]);

		yield* outcomes([
			["RPC answer", () => socketAnswer(), expect.objectContaining({ body: expect.stringContaining("accepted"), connection: "open" })],
			["handled calls", () => handledCalls(), [accepted.text]],
		]);
	},
);

for (const path of ["/rpc", "/rpc?auth=frame"]) {
	socketBody.it(
		`a zero limit refuses a nonempty frame at ${path}`,
		[echoRpc, configuration({ maxBodySize: 0 })],
		function* ({ handledCalls, openSocket, sendSocketMessage, socketAnswer }) {
			yield* openSocket(path);
			if (path === "/rpc") {
				yield* sendSocketMessage("");
			}
			yield* sendSocketMessage("x");

			yield* outcomes([
				[
					"socket closure",
					() => socketAnswer(),
					expect.objectContaining({
						closeReason: "RPC frame exceeds maxBodySize",
						code: 1009,
						connection: "closed",
						error: "SocketError",
						reason: "SocketCloseError",
					}),
				],
				["handled calls", () => handledCalls(), []],
			]);
		},
	);
}
