import { createContext, useContext } from "react";
import type { BrowserClient } from "#client/client.ts";

export type FormClient = Pick<BrowserClient, "handoffs" | "responses" | "runtime"> & {
	readonly updates: Pick<BrowserClient["updates"], "status">;
};
export const FormContext = createContext<FormClient | undefined>(undefined);

export function useFormClient() {
	const client = useContext(FormContext);
	if (!client) {
		throw new Error("Board forms require the shell's RPC client");
	}
	return client;
}
