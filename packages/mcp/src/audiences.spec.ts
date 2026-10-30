import { expect } from "vitest";
import { mcp } from "#test/mcp.ts";
import { connectedAs } from "#test/traits.ts";

for (const [title, name, role, tools] of [
	["alice's client, connected as a user, discovers only whoami", "alice", "user", ["whoami"]],
	["ada's client, connected as an admin, discovers whoami, adminOnly and refuse", "ada", "admin", ["whoami", "adminOnly", "refuse"]],
] as const) {
	mcp.it(title, [connectedAs(name, role)], function* ({ listTools }) {
		expect(yield* listTools(name)).toEqual(tools);
	});
}

mcp.it(
	"whoami answers alice's client with alice, though ada's client connected and called it first",
	[connectedAs("ada", "admin"), connectedAs("alice", "user")],
	function* ({ call }) {
		yield* call("ada", "whoami");

		expect(yield* call("alice", "whoami")).toBe("answered alice");
	},
);

mcp.it("adminOnly answers ada's client with admin:ada, naming her as the caller", [connectedAs("ada", "admin")], function* ({ call }) {
	expect(yield* call("ada", "adminOnly")).toBe("answered admin:ada");
});

mcp.it("alice's client calling the hidden adminOnly by name is refused as not found", [connectedAs("alice", "user")], function* ({ call }) {
	expect(yield* call("alice", "adminOnly")).toBe("refused: Tool 'adminOnly' not found");
});

mcp.it(
	"refuse's typed failure reaches ada's client as an error result saying Application refused",
	[connectedAs("ada", "admin")],
	function* ({ call }) {
		expect(yield* call("ada", "refuse")).toBe("failed: Application refused");
	},
);

mcp.it(
	"once ada steps down to user, her connected client discovers only whoami",
	[connectedAs("ada", "admin")],
	function* ({ listTools, stepsDown }) {
		expect(yield* listTools("ada")).toEqual(["whoami", "adminOnly", "refuse"]);

		yield* stepsDown("ada");

		expect(yield* listTools("ada")).toEqual(["whoami"]);
	},
);

mcp.it(
	"once ada steps down to user, her connected client's adminOnly call is refused as not found",
	[connectedAs("ada", "admin")],
	function* ({ call, stepsDown }) {
		expect(yield* call("ada", "adminOnly")).toBe("answered admin:ada");

		yield* stepsDown("ada");

		expect(yield* call("ada", "adminOnly")).toBe("refused: Tool 'adminOnly' not found");
	},
);

mcp.it(
	"once ada removes alice's account, alice's connected client is refused as unauthorized",
	[connectedAs("alice", "user"), connectedAs("ada", "admin")],
	function* ({ listTools, removesAccount }) {
		expect(yield* listTools("alice")).toEqual(["whoami"]);

		yield* removesAccount("ada", "alice");

		expect(yield* listTools("alice")).toBe("unauthorized");
	},
);
