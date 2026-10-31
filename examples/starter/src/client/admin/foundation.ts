import type { RetryJob } from "@shivaedev/admin/client/jobsTypes.ts";
import { bind, makeClient } from "@shivaedev/contract/bind.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { foundation } from "#modules.ts";

export function makeFoundationClient(url: string, options: Omit<ClientOptions, "url"> = {}) {
	const {
		api: users,
		Client,
		runtime,
	} = makeClient(foundation.UsersPage.contract, {
		group: foundation.admin.group,
		url,
		...options,
	});
	return {
		changeRole: runtime.fn(users.changeRole.run),
		jobs: bind(foundation.JobsPage.contract, Client),
		runtime,
		users,
	};
}
export type FoundationClient = Pick<ReturnType<typeof makeFoundationClient>, "jobs" | "users" | "changeRole"> & { readonly retry?: RetryJob };
