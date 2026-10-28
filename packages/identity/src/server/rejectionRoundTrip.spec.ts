import { expect } from "vitest";
import { rejections } from "#test/rpc/rejections.ts";

for (const [rejectWith, answer] of [
	["a conflict on a field", "Conflict on name: Name is taken"],
	["a bad request on a field", "BadRequest on name: Name is required"],
	["a bad request on the whole form", "BadRequest: Malformed"],
	["a failed precondition", "PreconditionFailed: Profile changed"],
	["a missing profile", "NotFound: No profile"],
	["too many requests", "TooManyRequests: Slow down"],
	["a forbidden change", "Forbidden: No"],
	["an app-defined field error", "Invalid on title: Too long"],
] as const) {
	rejections.it(
		`a rename rejected with ${rejectWith} reaches the caller over RPC JSON as the same decoded error`,
		[],
		function* ({ renameRejectedWith }) {
			expect(yield* renameRejectedWith(rejectWith)).toBe(answer);
		},
	);
}
