import { useAtomSuspense } from "@effect/atom-react";
import { Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { createContext, useContext } from "react";
import type { BrowserClient } from "#adapters/browserClient.ts";
import { clockReading } from "#client/react/adapters/now.ts";

export type FormClient = Pick<BrowserClient, "handoffs" | "responses" | "runtime"> & {
	readonly updates: Pick<BrowserClient["updates"], "status">;
};
export const FormContext = createContext<FormClient | undefined>(undefined);

const defaultRuntime = Atom.runtime(Layer.empty);
const clocks = Atom.family((runtime: Pick<Atom.AtomRuntime<never>, "atom">) => runtime.atom(clockReading));

function useClockReading() {
	const client = useContext(FormContext);
	return useAtomSuspense(clocks(client?.runtime ?? defaultRuntime)).value;
}

export function useBoardClock() {
	return useClockReading().clock;
}

export function useFormClient() {
	const client = useContext(FormContext);
	const { now } = useClockReading();
	if (!client) {
		throw new Error("Board forms require the shell's RPC client");
	}
	return { ...client, now };
}
