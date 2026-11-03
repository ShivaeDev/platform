import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { RetryJob } from "@shivaedev/admin/client/adapters/jobsTypes.ts";
import { bind, makeClient } from "@shivaedev/contract/bind.ts";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { foundation } from "#admin/foundation.ts";

export function makeFoundationClient(url: string, options: Omit<ClientOptions, "url"> & { readonly registry?: AtomRegistry.AtomRegistry } = {}) {
	const transport = makeClient(foundation.UsersPage.contract, {
		group: foundation.admin.group,
		url,
		...options,
	});
	const { api: users, Client, runtime } = transport;
	const sessions = bind(foundation.SessionsPage.contract, Client, { ...options, live: options.live ?? true });
	return Object.assign(transport, {
		activity: clientActivity(transport),
		changeRole: runtime.fn(users.changeRole.run),
		jobs: bind(foundation.JobsPage.contract, Client, { ...options, live: options.live ?? true }),
		sessions,
		users,
	});
}
export type FoundationClient = Pick<ReturnType<typeof makeFoundationClient>, "jobs" | "users" | "changeRole" | "runtime" | "sessions"> & {
	readonly retry?: RetryJob;
};
