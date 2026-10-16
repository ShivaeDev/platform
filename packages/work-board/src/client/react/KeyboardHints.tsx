import type { ReactNode } from "react";
import { useMedia } from "./useMedia.ts";

export function KeyboardHints({ children }: { readonly children: ReactNode }) {
	const touch = useMedia("(any-pointer: coarse)");
	return touch || navigator.maxTouchPoints > 0 ? null : children;
}
