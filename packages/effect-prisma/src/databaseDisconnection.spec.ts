import { beforeAll, describe, expect, it } from "vitest";
import { environmentVariable } from "#test/environment.ts";
import { runDisconnectedBegin } from "#test/runDisconnectedBegin.ts";

describe.runIf(environmentVariable("PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL") !== undefined)("PostgreSQL disconnect before BEGIN", () => {
	let result: Awaited<ReturnType<typeof runDisconnectedBegin>>;
	beforeAll(async () => {
		result = await runDisconnectedBegin();
		if (result.status !== 0) {
			expect(result.stderr).toBe("uncaughtException: Connection terminated unexpectedly\n");
		}
		expect(JSON.parse(result.stdout)).toMatchObject({ begins: 1, kind: "PrismaConnectionFailure", original: { kind: "sql_connection" } });
	});

	it("preserves the original connection error after transaction acquisition fails", () => {
		expect(JSON.parse(result.stdout)).toMatchObject({ original: { message: "Connection terminated unexpectedly" } });
	});

	it.fails("BUG: survives a PostgreSQL disconnect before BEGIN without an uncaught pg error", () => {
		expect(result.stderr).toBe("");
		expect(result.status).toBe(0);
	});
});
