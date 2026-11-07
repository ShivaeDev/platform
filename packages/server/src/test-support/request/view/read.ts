import { Effect } from "effect";
import { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import { Subject } from "@shivaedev/identity/subject.ts";
import type { initialize } from "#test/request/view/initialize.ts";

export function read(state: Effect.Success<typeof initialize>) {
	return Effect.fn("RequestViewService.read")(function* () {
		const user = yield* SessionUser;
		const identity = yield* Identity;
		const subject = yield* Subject;
		return { cached: yield* state.cached, caller: user.id, captured: state.caller, identity: identity.id, subject: subject.id };
	});
}
