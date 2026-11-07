import { createElement } from "react";
import { render } from "@shivaedev/test-story/client/adapters/react.ts";
import type { connect } from "#test/compared-postgres/connect.ts";
import { Notes } from "#test/compared-postgres/Notes.tsx";

export function openScreen(client: ReturnType<typeof connect>, name: "list" | "independent" = "list") {
	return render(createElement(Notes, { client, name }));
}
