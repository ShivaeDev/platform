import { expect, it } from "vitest";
import { readerLink } from "./readerLink.ts";

it("leaves legacy response links to the server while routing answer cards in the client", () => {
	expect(readerLink(new URL("/_board/respond?item=task.one&request=direction", location.href))).toBe(false);
	expect(readerLink(new URL("/_board/item/task.one/#answer-card-direction", location.href))).toBe(true);
});
