import { Effect, Layer, Option } from "effect";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { TestRoles } from "#test/permissions.ts";

export const sessions = Layer.succeed(SessionPolicy, {
	origin: () => true,
	provider: {
		get: (headers) =>
			Effect.succeed(
				headers.authorization === "alice"
					? Option.some({ user: { email: "alice@example.test", id: "alice", name: "Alice", role: "operator" } })
					: Option.none(),
			),
	},
	roles: TestRoles,
});
