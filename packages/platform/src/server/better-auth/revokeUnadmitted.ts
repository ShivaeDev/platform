import { Effect } from "effect";
import { fromStorage, type PolicyStorage, type SignInGate } from "#server/better-auth/signInGate.ts";

export interface RevokedSessions {
	readonly sessions: number;
	readonly users: number;
}

const PAGE_SIZE = 100;

export const revokeUnadmitted = Effect.fnUntraced(function* <E>(gate: SignInGate<E>, storage: () => Promise<PolicyStorage>) {
	if (!gate.active) {
		return { sessions: 0, users: 0 } satisfies RevokedSessions;
	}
	const auth = yield* fromStorage(storage);
	const revoked: Array<{ readonly sessions: number; readonly userId: string }> = [];
	for (let offset = 0; ; offset += PAGE_SIZE) {
		const users = yield* fromStorage(() => auth.internalAdapter.listUsers(PAGE_SIZE, offset, { direction: "asc", field: "id" }));
		for (const { id } of users) {
			if (!(yield* gate.admitsUser(auth, id))) {
				const sessions = Number(yield* fromStorage(() => auth.adapter.count({ model: "session", where: [{ field: "userId", value: id }] })));
				if (sessions > 0) {
					revoked.push({ sessions, userId: id });
				}
			}
		}
		if (users.length < PAGE_SIZE) {
			break;
		}
	}
	for (const { userId } of revoked) {
		yield* fromStorage(() => auth.internalAdapter.deleteUserSessions(userId));
	}
	return { sessions: revoked.reduce((total, user) => total + user.sessions, 0), users: revoked.length } satisfies RevokedSessions;
});
