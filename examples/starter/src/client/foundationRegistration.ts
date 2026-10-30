import { type FoundationClient, makeFoundationClient } from "#client/admin/foundation.ts";
import { foundationRoutes } from "#client/admin/foundationRoutes.tsx";
import { foundation } from "#modules.ts";
import type { ClientModule } from "./Module.ts";

export function foundationRegistration(
	client: FoundationClient = makeFoundationClient(new URL("/rpc", window.location.href).href),
): ClientModule<ReturnType<typeof foundationRoutes>[number]> {
	return {
		admin: foundation.admin,
		api: client.users,
		bindings: [client.users, client.jobs],
		routes: ({ root, session, adminPages }) => foundationRoutes(client, { adminPages, getParentRoute: () => root, session }),
	};
}
