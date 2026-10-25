import { expect, it } from "vitest";
import { readerLink } from "./readerLink.ts";

const ORIGIN = "http://127.0.0.1:4310";

it("leaves legacy response links to the server while routing answer cards in the client", () => {
	expect(readerLink(new URL("/_board/respond?item=task.one&request=direction", ORIGIN), ORIGIN)).toBe(false);
	expect(readerLink(new URL("/_board/item/task.one/#answer-card-direction", ORIGIN), ORIGIN)).toBe(true);
});

it("leaves links to another origin to the browser", () => {
	expect(readerLink(new URL("/_board/item/task.one/", "http://127.0.0.1:4311"), ORIGIN)).toBe(false);
});
