import { type ComponentProps, createContext, createElement, useContext, useLayoutEffect, useRef } from "react";
import type { ExtraProps } from "react-markdown";
import { textContent } from "#render/textContent.ts";

export const DetailStatesContext = createContext(new Map<string, boolean>());

export function DocumentDetails({ node, children, ...props }: ComponentProps<"details"> & ExtraProps) {
	const states = useContext(DetailStatesContext);
	const elementRef = useRef<HTMLDetailsElement>(null);
	const identity = node?.children.map(textContent).join("") ?? "";
	useLayoutEffect(() => {
		const element = elementRef.current;
		if (!element) {
			return;
		}
		element.open = states.get(identity) ?? props.open ?? false;
		return () => {
			states.set(identity, element.open);
		};
	}, [identity, props.open, states]);
	return createElement("details", { ...props, ref: elementRef }, children);
}
