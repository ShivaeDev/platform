import { createElement } from "react";
import { render } from "@shivaedev/test-story/client/react.ts";
import type { connect } from "./connect.ts";
import { Notes } from "./Notes.tsx";

export function openScreen(client: ReturnType<typeof connect>) {
	return render(createElement(Notes, { client }));
}
