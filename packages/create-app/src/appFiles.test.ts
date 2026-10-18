import { expect, it } from "vitest";
import { databaseName } from "#appFiles.ts";

it("derives a PostgreSQL-safe database name from the app name", () => {
	expect(databaseName("my-app")).toBe("my_app");
	expect(databaseName("2.app")).toBe("app_2_app");
	expect(databaseName("a".repeat(70))).toBe("a".repeat(58));
});
