import { bakery, ovenIsLit } from "#test/bakery.ts";

bakery.it("rejects a tag the consumer forgot to declare", [ovenIsLit()], undefined, { tags: "undeclared-consumer-tag" });
