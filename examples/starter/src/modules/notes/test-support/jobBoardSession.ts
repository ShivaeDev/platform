import { Effect } from "effect";
import { mintUser } from "#test-support/sessionPrecondition.ts";

export const jobBoardSession = Effect.fn("JobBoardStory.jobBoardSession")(function* (role: "admin" | "user") {
	const { headers } = yield* mintUser({ origin: "http://127.0.0.1" }, role, role);
	return headers.get("cookie") ?? "";
});
