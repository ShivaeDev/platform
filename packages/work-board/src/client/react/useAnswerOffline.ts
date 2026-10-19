import { useAtomValue } from "@effect/atom-react";
import { useFormClient } from "./FormContext.ts";

export function useAnswerOffline() {
	const live = useAtomValue(useFormClient().updates.status).connection === "live";
	return live ? undefined : "Reconnecting to the Board. You can answer once it is back.";
}
