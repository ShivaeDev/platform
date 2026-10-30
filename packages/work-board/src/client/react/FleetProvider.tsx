import { Option } from "effect";
import type { ReactNode } from "react";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { FleetItemsContext } from "#client/react/FleetItemsContext.ts";
import { routeQueryOptions } from "#client/react/routeQuery.ts";
import type { ShellApi } from "#client/react/ShellApi.ts";
import { TimeTicker } from "#client/react/Time.tsx";

export function FleetProvider({ api, children }: { readonly api: ShellApi; readonly children: ReactNode }) {
	const query = useQuery(api.fleetItems.query(undefined, routeQueryOptions), { keepPreviousData: true });
	return (
		<FleetItemsContext.Provider value={Option.getOrUndefined(query.data)}>
			<TimeTicker>{children}</TimeTicker>
		</FleetItemsContext.Provider>
	);
}
