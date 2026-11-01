import { Link } from "@tanstack/react-router";
import { createElement, type ReactNode } from "react";

export interface ForbiddenProps {
	readonly backLabel?: string;
	readonly children?: ReactNode;
	readonly className?: string;
	readonly title?: string;
	readonly to: string;
}

export function Forbidden({
	to,
	title = "Permission denied",
	children = "You do not have access to this page.",
	backLabel = "Go back",
	className,
}: ForbiddenProps): ReactNode {
	return createElement(
		"main",
		{ className },
		createElement("h1", null, title),
		createElement("p", null, children),
		createElement(Link, { to }, backLabel),
	);
}
