import { useAtomSuspense } from "@effect/atom-react";
import { Clock } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { createContext, useContext } from "react";
import type { BrowserClient } from "#browserClient.ts";

export type FormClient = Pick<BrowserClient, "handoffs" | "responses" | "runtime"> & {
	readonly updates: Pick<BrowserClient["updates"], "status">;
};
export const FormContext = createContext<FormClient | undefined>(undefined);

const clocks = Atom.family((runtime: Pick<Atom.AtomRuntime<never>, "atom">) => runtime.atom(Clock.Clock));

export function useFormClient() {
	const client = useContext(FormContext);
	if (!client) {
		throw new Error("Board forms require the shell's RPC client");
	}
	const clock = useAtomSuspense(clocks(client.runtime)).value;
	return { ...client, now: () => clock.currentTimeMillisUnsafe() };
}
