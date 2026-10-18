import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { applyTheme, savedTheme } from "./applyTheme.ts";
import { makeAuth } from "./auth.ts";
import { makeNotesClient } from "./makeNotes.ts";
import "#client/entry.css";

applyTheme(savedTheme());

const container = document.getElementById("root");
if (container === null) {
	throw new Error("Missing application root");
}
const auth = makeAuth({ baseUrl: window.location.origin });
function connect() {
	return makeNotesClient(new URL("/rpc", window.location.href).href);
}
createRoot(container).render(<App auth={auth} connect={connect} />);
