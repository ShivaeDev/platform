import { Buffer } from "node:buffer";
import { expect, it } from "vitest";
import { appFile, databaseName } from "#appFiles.ts";

it("preserves binary files and nested documentation when naming an app", () => {
	const content = Buffer.from([0, 0xff, 0x80, 0x41]);
	expect(appFile("image.png", content, "demo")).toEqual(content);
	const readme = Buffer.from("# {{appName}}");
	expect(appFile("docs/README.md", readme, "demo")).toEqual(readme);
});

it("derives a PostgreSQL-safe database name from the app name", () => {
	expect(databaseName("my-app")).toBe("my_app");
	expect(databaseName("2.app")).toBe("app_2_app");
	expect(databaseName("a".repeat(70))).toBe("a".repeat(58));
});
