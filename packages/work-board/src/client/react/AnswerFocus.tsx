import { type ReactNode, useLayoutEffect } from "react";
import { attachResponses } from "#client/entry.ts";
export function AnswerFocus({ children, context }: { readonly children: ReactNode; readonly context: string }) {
	useLayoutEffect(() => {
		if (context) {
			attachResponses();
		}
	}, [context]);
	return <div>{children}</div>;
}
