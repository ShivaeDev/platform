import { expect } from "vitest";
import { prisma } from "#test/prisma.ts";

prisma.it(
	"recordWrite applies the map to a write observed by the application's own client",
	[],
	function* ({ recording: { published, unnamed, record } }) {
		yield* record("Membership", "create", { memberId: "bob", ownerId: "ada" });
		yield* record("Membership", "updateManyAndReturn", [
			{ memberId: "cyd", ownerId: "ada" },
			{ memberId: "ada", ownerId: "dan" },
		]);
		yield* record("Membership", "deleteMany", { count: 2 });
		yield* record("Membership", "update", { ownerId: "ada" });
		yield* record("Membership", "findMany", [{ memberId: "fay", ownerId: "eve" }]);
		yield* record("AuditNote", "create", { id: "n1" });
		yield* record("Invoice", "create", { ownerId: "ada" });
		expect(published).toEqual([
			["ada", "bob"],
			["ada", "cyd", "dan"],
		]);
		expect(unnamed).toEqual([
			{ model: "Membership", operation: "deleteMany", reason: "countOnly" },
			{ field: "memberId", model: "Membership", operation: "update", reason: "narrowed" },
		]);
	},
);
