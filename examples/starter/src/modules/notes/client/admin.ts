import { bind, makeClient } from "@shivaedev/contract/bind.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import type { RetryJob } from "#client/admin/jobsTypes.ts";
import { Admin, JobsPage, StatisticsPage, UsersPage } from "#modules/notes/admin.ts";

export function makeAdminClient(url: string, options: Omit<ClientOptions, "url"> = {}) {
	const {
		api: users,
		Client,
		runtime,
	} = makeClient(UsersPage.contract, {
		group: Admin.group,
		url,
		...options,
	});
	return {
		changeRole: runtime.fn(users.changeRole.run),
		jobs: bind(JobsPage.contract, Client),
		runtime,
		statistics: bind(StatisticsPage.contract, Client),
		users,
	};
}
export type AdminClient = ReturnType<typeof makeAdminClient> & { readonly retry?: RetryJob };
