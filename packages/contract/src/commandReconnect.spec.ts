import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { commands, connected } from "#test/commands/story.ts";

for (const source of ["native", "visibilitychange", "online", "pageshow"] as const) {
	commands.it(
		`${source} detects a silent socket and delivers the held command after reconnect`,
		[connected()],
		function* ({ add, answer, pass, resume, silence, untilWaiting }) {
			yield* silence();
			resume(source);
			yield* add(3);
			yield* untilWaiting();

			yield* pass(3500);

			expect(yield* answer()).toBe("counter: 3");
		},
	);
}

for (const [label, custom, shared] of [
	["default", false, false],
	["supplied", true, false],
	["shared supplied", true, true],
] as const) {
	commands.it(
		`${label} protocol holds a reconnecting command and reports waiting until it succeeds`,
		[connected(custom, shared)],
		function* ({ add, answer, drop, pass, restore, status, untilWaiting }) {
			yield* drop();
			yield* add(2);
			yield* untilWaiting();

			expect(yield* status()).toBe("waiting-for-connection");

			yield* restore();
			yield* pass(1000);

			expect(yield* answer()).toBe("counter: 2");
		},
	);
	commands.it(
		`${label} protocol times out an unsent command after ten seconds and never sends it later`,
		[connected(custom, shared)],
		function* ({ add, answer, drop, pass, restore, untilConnected, untilWaiting, value }) {
			yield* drop();
			yield* add(2);
			yield* untilWaiting();

			yield* pass(10_000);

			expect(yield* answer()).toBe("RpcClientError: SocketOpenError Timeout");

			yield* restore();
			yield* pass(1000);
			yield* untilConnected();

			expect(yield* value()).toBe("counter: 0");
		},
	);
}

commands.it(
	"a command already executed before disconnect fails and is never replayed",
	[connected()],
	function* ({ add, answer, drop, executed, holdResponse, pass, restore, untilConnected, value }) {
		holdResponse();
		yield* add(4);
		expect(yield* executed()).toBe("counter: 4");

		yield* drop();

		expect(yield* answer()).toBe("RpcClientError: SocketReadError");

		yield* restore();
		yield* pass(1000);
		yield* untilConnected();

		expect(yield* value()).toBe("counter: 4");
	},
);

commands.it(
	"an interrupted held command leaves waiting status and never reaches the server",
	[connected()],
	function* ({ add, cancel, drop, pass, restore, status, untilConnected, untilWaiting, value }) {
		yield* drop();
		yield* add(5);
		yield* untilWaiting();
		expect(yield* status()).toBe("waiting-for-connection");

		yield* cancel();

		expect(yield* status()).toBe("live");

		yield* restore();
		yield* pass(1000);
		yield* untilConnected();

		expect(yield* value()).toBe("counter: 0");
	},
);

commands.it("a healthy resume Pong releases the command without replacing the socket", [connected()], function* ({ add, answer, opened, resume }) {
	expect(yield* opened()).toBe("1 socket handshakes");

	resume("native");
	yield* add(1);

	yield* outcomes([
		["command response", () => answer(), "counter: 1"],
		["socket handshakes", () => opened(), "1 socket handshakes"],
	]);
});

commands.it(
	"a burst of resume events keeps the first probe deadline and delivers the held command",
	[connected()],
	function* ({ add, answer, pass, resume, silence, untilWaiting }) {
		yield* silence();
		resume("online");
		yield* add(3);
		yield* untilWaiting();
		yield* pass(1000);

		resume("pageshow");
		resume("visibilitychange");
		yield* pass(2200);

		expect(yield* answer()).toBe("counter: 3");
	},
);
