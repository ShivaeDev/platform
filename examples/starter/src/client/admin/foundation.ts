import type { RetryJob } from "@shivaedev/admin/client/jobsTypes.ts";
import { bind, makeClient } from "@shivaedev/contract/bind.ts";
import { clientActivity } from "@shivaedev/contract/clientActivity.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { foundation } from "#modules.ts";

export function makeFoundationClient(url: string, options: Omit<ClientOptions, "url"> = {}) {
	const transport = makeClient(foundation.UsersPage.contract, {
		group: foundation.admin.group,
		url,
		...options,
	});
	const { api: users, Client, runtime } = transport;
	const sessions = bind(foundation.SessionsPage.contract, Client, { live: options.live ?? true });
	return {
		activity: clientActivity(transport),
		changeRole: runtime.fn(users.changeRole.run),
		jobs: bind(foundation.JobsPage.contract, Client, { live: options.live ?? true }),
		runtime,
		sessions,
		users,
	};
}
export type FoundationClient = Pick<ReturnType<typeof makeFoundationClient>, "jobs" | "users" | "changeRole" | "runtime" | "sessions"> & {
	readonly retry?: RetryJob;
};
