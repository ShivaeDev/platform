import { expect, it } from "vitest";
import { responseUrl } from "./url.ts";

it("encodes the item path and the answer card's element id once", () => {
	const url = new URL(responseUrl("item/one%", "decision/direction% #"), "http://127.0.0.1");
	expect(url.pathname).toBe("/_board/item/item%2Fone%25/");
	expect(url.hash).toBe("#answer-card-decision%2Fdirection%25%20%23");
	expect(decodeURIComponent(url.hash.slice(1))).toBe("answer-card-decision/direction% #");
});
