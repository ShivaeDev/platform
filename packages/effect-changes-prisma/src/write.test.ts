import { expect } from "vitest";
import { prisma } from "#test/prisma.ts";
import { invoicesAreUnmapped, membershipsExist } from "#test/prismaTraits.ts";

prisma.it(
	"recordWrite applies the map to a write observed by the application's own client",
	[invoicesAreUnmapped(), membershipsExist({ id: "m2", memberId: "cyd", ownerId: "ada" }, { id: "m3", memberId: "ada", ownerId: "dan" })],
	function* ({ recordClientWrite, published, unnamed }) {
		yield* recordClientWrite("Membership", "create", (db) => db.membership.create({ data: { id: "m1", memberId: "bob", ownerId: "ada" } }));
		yield* recordClientWrite("Membership", "updateManyAndReturn", (db) =>
			db.membership.updateManyAndReturn({ data: { memberId: "cyd" }, where: { id: { in: ["m2", "m3"] } } }),
		);
		yield* recordClientWrite("Membership", "deleteMany", (db) => db.membership.deleteMany({ where: { id: { in: ["m2", "m3"] } } }));
		yield* recordClientWrite("Membership", "update", (db) => db.membership.update({ data: {}, select: { ownerId: true }, where: { id: "m1" } }));
		yield* recordClientWrite("Membership", "findMany", (db) => db.membership.findMany());
		yield* recordClientWrite("AuditNote", "create", (db) => db.auditNote.create({ data: { id: "n1", text: "checked" } }));
		yield* recordClientWrite("Invoice", "create", (db) => db.invoice.create({ data: { id: "i1", ownerId: "ada" } }));
		expect(published()).toEqual([
			["ada:memberships", "bob:memberships"],
			["ada:memberships", "cyd:memberships", "dan:memberships"],
		]);
		expect(unnamed).toEqual([
			{ model: "Membership", operation: "deleteMany", reason: "countOnly" },
			{ field: "memberId", model: "Membership", operation: "update", reason: "narrowed" },
		]);
	},
);
