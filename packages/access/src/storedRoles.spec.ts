import { expect } from "vitest";
import { accessStory } from "#test/accessStory.ts";

for (const [position, role] of [
	["first", "reader"],
	["last", "guest"],
] as const) {
	accessStory.it(`the stored name of the ${position} declared role, ${role}, decodes to the role ${role}`, [], function* ({ decodeRole }) {
		expect(yield* decodeRole(role)).toBe(role);
	});
}

accessStory.it("an undeclared stored role is rejected when decoded", [], function* ({ decodeRole }) {
	expect(yield* decodeRole("retired-role")).toBe("rejected as an undeclared role");
});

accessStory.it(
	"the stored role manager resolves to its declared grants users.read.any and roles.assign, each as a plain name and strength",
	[],
	function* ({ resolve }) {
		expect(yield* resolve("manager")).toEqual({
			permissions: [
				{ name: "users.read", strength: "any" },
				{ name: "roles.assign", strength: "own" },
			],
			role: "manager",
		});
	},
);

accessStory.it("an undeclared stored role is rejected when resolved, not resolved to an empty role", [], function* ({ resolve }) {
	expect(yield* resolve("retired-role")).toBe("rejected as an undeclared role");
});
