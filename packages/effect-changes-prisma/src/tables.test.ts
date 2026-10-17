import { expect } from "vitest";
import { prisma } from "#test/prisma.ts";
import { schemaIs } from "#test/prismaTraits.ts";

const schema = `
generator client {
  provider = "prisma-client"
}

/// Orders placed by an owner.
model Order {
  id      String @id
  ownerId String @map("owner_id") // @@map("not_this")

  @@map("orders")
}

model InvoiceLine {
  id String @id
  @@index([id])
  @@map(name: "invoice_lines")
}

model AuditNote {
  id   String @id
  text String @default("{}")
}

enum Status {
  open
}
`;
prisma.it("tablesOf maps each table to its model, honouring @@map and ignoring comments", [schemaIs(schema)], function* ({ tableModels }) {
	expect(yield* tableModels()).toEqual([
		["orders", "Order"],
		["invoice_lines", "InvoiceLine"],
		["AuditNote", "AuditNote"],
	]);
});
