import { Buffer } from "node:buffer";
import { expect, it } from "vitest";
import { appFile } from "#appFiles.ts";

it("preserves binary files and nested documentation when naming an app", () => {
	const content = Buffer.from([0, 0xff, 0x80, 0x41]);
	expect(appFile("image.png", content, "demo")).toEqual(content);
	const readme = Buffer.from("# {{appName}}");
	expect(appFile("docs/README.md", readme, "demo")).toEqual(readme);
});
