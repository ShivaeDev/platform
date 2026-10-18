import { Buffer } from "node:buffer";
import { expect, it } from "vitest";
import { prepareFile, registryDependencies } from "#template.ts";

it("preserves binary files when preparing the template", () => {
	const content = Buffer.from([0, 0xff, 0x80, 0x41]);
	expect(prepareFile("image.png", content, {})).toEqual(content);
});

it("uses exact registry versions and refuses missing or floating workspace replacements", () => {
	expect(registryDependencies({ "@shivaedev/platform": "workspace:*", effect: "catalog:" }, { "@shivaedev/platform": "0.6.1" })).toEqual({
		"@shivaedev/platform": "0.6.1",
		effect: "catalog:",
	});
	for (const versions of [{}, { "@shivaedev/platform": "latest" }, { "@shivaedev/platform": "^0.6.1" }]) {
		expect(() => registryDependencies({ "@shivaedev/platform": "workspace:*" }, versions)).toThrow("name an exact published version");
	}
});
