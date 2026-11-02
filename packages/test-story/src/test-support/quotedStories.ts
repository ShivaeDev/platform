import { expect } from "vitest";
import { mill } from "#test/mill.ts";

mill.it('the miller\'s "rye" costs $5 (today) [lot 1] \\ `printf changed`', [], ({ sacks }) => {
	expect(sacks(), "sacks").toBe(1);
});

mill.it('the miller\'s "rye" costs $5 today lot 1', [], ({ sacks }) => {
	expect(sacks()).toBe(0);
});
