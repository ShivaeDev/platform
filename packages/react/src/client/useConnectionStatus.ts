import { useAtomValue } from "@effect/atom-react";
import { type ActiveClient, type ConnectionStatus, clientActivity } from "@shivaedev/contract/clientActivity.ts";

export function useConnectionStatus(client: ActiveClient): ConnectionStatus {
	return useAtomValue(clientActivity(client).connectionStatus);
}
