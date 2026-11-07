import { Effect } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";

export function read(state: { readonly capturedRole: string }) {
	return Effect.fn("RoleView.read")(function* () {
		return { capturedRole: state.capturedRole, role: (yield* SessionUser).role ?? "member" };
	});
}
