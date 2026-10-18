import { expect } from "vitest";
import { migration } from "#test-support/migration.ts";

migration.it("numbered migrations satisfy the configured Better Auth plugins", [], function* ({ migrate, pendingAuthMigrations }) {
	yield* migrate();
	const pending = yield* pendingAuthMigrations();
	expect(pending.toBeAdded).toEqual([]);
	expect(pending.toBeCreated).toEqual([]);
});
