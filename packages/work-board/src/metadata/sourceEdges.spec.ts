import { expect, it } from "vitest";
import { sourceHref } from "#metadata/sourceLinks.ts";

it("discloses a malformed external evidence URL instead of exposing a broken reader link", () => {
	expect(sourceHref("http://[", "nested/item.md")).toBeUndefined();
});
