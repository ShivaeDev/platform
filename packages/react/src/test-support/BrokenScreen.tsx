import type { ReactNode } from "react";

export function BrokenScreen({ failure }: { failure: Error }): ReactNode {
	throw failure;
}
