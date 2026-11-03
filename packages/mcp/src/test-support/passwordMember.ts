import { passwordUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { mcp } from "./mcp.ts";

export const passwordMember = mcp.trait("people", "alice has a password account", function* (engine) {
	const user = yield* passwordUser(engine.auth, {
		email: "alice@mcp.test",
		name: "alice",
		password: "correct-horse-battery-staple",
	});
	engine.people.set("alice", { cookie: "", id: user.id });
});
