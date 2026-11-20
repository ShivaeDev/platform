const REPAIR =
	"React sees a new component type on every call of the function around it, so the subtree remounts and loses its state. Move it to module level and pass what it reads as props.";

function nested(name: string): string {
	return `Component ${name} is defined inside another function. ${REPAIR}`;
}

export const NESTED_HOOK =
	"Hook useRow is defined inside another function. Every call of the function around it makes a new hook. Move it to module level and pass what it reads as arguments.";

export const FAILURE_HANDLERS = {
	content: [
		"export function Retitle() {",
		'\tconst save = useAction(client.notes.rename, { failures: { SubtitleRejected: (error) => ({ field: "title", message: error.message }) } });',
		'\tconst remove = useAction(client.notes.remove, { failures: { Conflict: () => ({ message: "Someone else removed it" }) } });',
		"\treturn <Form remove={remove} save={save} />;",
		"}",
		"function useRetitle() {",
		'\treturn useAction(client.notes.rename, { failures: { SubtitleRejected: (error) => ({ field: "title", message: error.message }) } });',
		"}",
	]
		.join("\n")
		.concat("\n"),
	path: "src/Retitle.tsx",
};

export const METHOD_HANDLER = {
	content:
		'export function Archive() {\n\treturn useAction(api.archive, { failures: { Archived() { return { message: "Already archived" }; } } });\n}\n',
	path: "src/Archive.tsx",
};

export const nestedRejected = [
	{
		code: "function Screen() { const Row = () => <li />; return <ul />; }",
		message: nested("Row"),
		name: "an arrow that returns JSX inside a component",
	},
	{
		code: "function Screen() { function Row() { return <li />; } return <ul />; }",
		message: nested("Row"),
		name: "a function declaration that returns JSX inside a component",
	},
	{ code: "function useRows() { const Row = () => <li />; return Row; }", message: nested("Row"), name: "a component inside a custom hook" },
	{ code: "function rows() { const Row = () => <li />; return Row; }", message: nested("Row"), name: "a component a factory returns" },
	{
		code: "function Screen() { const Row = (p) => (p.on ? <li /> : null); return <ul />; }",
		message: nested("Row"),
		name: "a component that returns JSX in one branch",
	},
	{ code: "function Screen() { const Row = memo(() => <li />); return <ul />; }", message: nested("Row"), name: "a memo-wrapped component" },
	{
		code: "function Screen() { const Row = forwardRef((p, ref) => <li ref={ref} />); return <ul />; }",
		message: nested("Row"),
		name: "a forwardRef-wrapped component",
	},
	{
		code: "function Screen() { const Row = (p) => p.children; return <Row />; }",
		message: nested("Row"),
		name: "a component rendered as an element",
	},
	{
		code: "function Screen() { const Empty = () => null; return <Route component={Empty} />; }",
		message: nested("Empty"),
		name: "a component passed as a JSX attribute",
	},
	{
		code: "function Screen() { const Empty = () => null; return createElement(Empty); }",
		message: nested("Empty"),
		name: "a component given to createElement",
	},
	{
		code: "function Screen() { const parts = { Link: (p) => <a {...p} /> }; return <Md components={parts} />; }",
		message: nested("Link"),
		name: "a key whose function returns JSX",
	},
	{
		code: "function Screen() { return <Md components={{ Link: (p) => <a {...p} /> }} />; }",
		message: nested("Link"),
		name: "a key that returns JSX inside an attribute",
	},
	{
		code: "class Screen extends Component { render() { const Row = () => <li />; return <Row />; } }",
		message: nested("Row"),
		name: "a component inside a class render method",
	},
	{
		code: "function Screen() { class Row extends Component { render() { return <li />; } } return <Row />; }",
		message: nested("Row"),
		name: "a class component",
	},
];

export const hooksRejected = [
	{ code: "function Screen() { function useRow() { return 1; } return <ul />; }", name: "a hook inside a component" },
	{ code: "function useRows() { const useRow = () => 1; return useRow; }", name: "a hook inside a hook" },
	{ code: "function rows() { function useRow() { return 1; } return useRow; }", name: "a hook a factory returns" },
];

export const nestedAccepted = [
	{
		code: "function Screen() { const save = useAction(op, { failures: { Rejected: (error, input) => ({ message: input.title }) } }); return <ul />; }",
		name: "a two-parameter failure handler",
	},
	{ code: 'function load() { return Effect.catchTags(work, { SqlError: () => Effect.succeed("fallback") }); }', name: "an Effect catchTags handler" },
	{ code: "function Screen() { return <List renderItem={(item) => <li>{item}</li>} />; }", name: "a render prop" },
	{ code: "function Screen() { const render = () => <li />; return <ul>{render()}</ul>; }", name: "a lowercase function that returns JSX" },
	{
		code: "function Screen() { const Count = () => 1; return <ul>{Count()}</ul>; }",
		name: "a PascalCase function that returns no JSX and is never rendered",
	},
	{ code: "const Row = memo(() => <li />);\nfunction Screen() { return <Row />; }", name: "a component at module level" },
	{ code: "function Screen() { const Row = useMemo(() => <li />, []); return <ul>{Row}</ul>; }", name: "a memoized element" },
	{
		code: "const kit = { *create() { function Screen() { return <ul />; } return Screen; } };",
		name: "a component an object method builds once, such as a story kit's create",
	},
	{
		code: "function withRows(Screen) { function Rows() { return <Screen />; } return Rows; }",
		name: "a higher-order component that takes a component",
	},
	{
		code: 'vi.mock("#ui/scroll-area.tsx", () => ({ ScrollArea: ({ children }) => <div>{children}</div> }));',
		name: "a component a module mock returns",
	},
	{ code: "function Screen() { const parts = { useRow: () => 1 }; return <ul />; }", name: "a hook-named key" },
];
