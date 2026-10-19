import { Option } from "effect";
import { type ReactNode, useContext } from "react";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { FleetItemsContext } from "#client/react/FleetItemsContext.ts";
import { useLiveRead } from "#client/react/liveReady.ts";
import { routeQueryOptions } from "#client/react/routeQuery.ts";
import { SessionContext } from "#client/react/SessionContext.ts";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { TimeTicker } from "#client/react/Time.tsx";

export function FleetProvider({ api, children }: { readonly api: ShellApi; readonly children: ReactNode }) {
	const client = useContext(SessionContext);
	const query = useQuery(useLiveRead(client?.updates, api.fleetItems.query(undefined, routeQueryOptions)), { keepPreviousData: true });
	return (
		<FleetItemsContext.Provider value={Option.getOrUndefined(query.data)}>
			<TimeTicker>{children}</TimeTicker>
		</FleetItemsContext.Provider>
	);
}
