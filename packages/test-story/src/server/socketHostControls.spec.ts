import { expect } from "vitest";
import { outcomes } from "#server/outcomes.ts";
import { socketHost } from "#test/socketHost.ts";

socketHost.it(
	"closing the host's scope closes its open sockets, ends a held handshake and stops listening",
	[],
	function* ({ closesHost, held, holds, opens, socketEnd, startsOpening }) {
		yield* opens("alice");
		yield* holds();
		yield* startsOpening("bob");
		yield* held();

		yield* closesHost();
		yield* startsOpening("carol");

		yield* outcomes([
			["alice's open socket", () => socketEnd("alice"), "closed"],
			["bob's held handshake", () => socketEnd("bob"), "never opened"],
			["carol's socket after the close", () => socketEnd("carol"), "never opened"],
		]);
	},
);

socketHost.it("a paused host still reads a socket opened after the pause", [], function* ({ asks, opens, pauses }) {
	yield* opens("alice");

	yield* pauses();

	expect(yield* asks("bob")).toBe("bob");
});

socketHost.it(
	"the host counts and signals refused and held handshakes",
	[],
	function* ({ handshakes, held, holds, nextHandshake, refuses, socketEnd, startsOpening }) {
		expect(yield* handshakes()).toBe(0);

		yield* refuses();
		yield* startsOpening("alice");
		yield* nextHandshake();
		yield* holds();
		yield* startsOpening("bob");
		yield* nextHandshake();
		yield* held();

		yield* outcomes([
			["alice's refused handshake", () => socketEnd("alice"), "never opened"],
			["handshakes", () => handshakes(), 2],
		]);
	},
);
