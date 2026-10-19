import { createContext, useContext } from "react";
import type { BrowserClient } from "#browserClient.ts";

export type FormClient = Pick<BrowserClient, "handoffs" | "responses" | "runtime">;
export const FormContext = createContext<FormClient | undefined>(undefined);

export function useFormClient() {
	const client = useContext(FormContext);
	if (!client) {
		throw new Error("Board forms require the shell's RPC client");
	}
	return client;
}
