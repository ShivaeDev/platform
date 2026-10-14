import { Option } from "effect";
import type { ComponentProps } from "react";
import { useQuery } from "@shivaedev/effect-react/result-state.ts";
import { BoardMain } from "./BoardMain.tsx";
import { FleetItemsContext } from "./FleetItemsContext.ts";
export function FleetMain(props: ComponentProps<typeof BoardMain>) {
	const query = useQuery(props.api.fleetItems.query(undefined, { timeToLive: 60_000 }), { keepPreviousData: true });
	return (
		<FleetItemsContext.Provider value={Option.getOrUndefined(query.data)}>
			<BoardMain {...props} />
		</FleetItemsContext.Provider>
	);
}
