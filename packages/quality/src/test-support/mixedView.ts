export const conditionalView = `
const trace = [];
function element(tag, props, ...children) { return { tag, children }; }
function read(value) { trace.push(value); return value; }
function View(count) {
  const qualityContent = count;
  if (count < 0) return null;
  return <div><span>{read(qualityContent) && (read("branch") ? <b /> : null)}</span></div>;
}
`;

export const conciseView = `
const trace = [];
function element(tag, props, ...children) { return { tag, children }; }
function read(value) { trace.push(value); return value; }
const View = (count) => (<div>{read(count) ? <b /> : null}</div>);
`;

export const retainedView = `
function View({ items, ready }) {
 return <div title={sideEffect()}>{ready && <b />}{items.map(item => item.visible ? <i /> : null)}</div>;
}
`;

export const fragmentView = `
const trace = [];
function element(tag, props, ...children) { return { tag, children }; }
const View = (count) => <>{count ? <b /> : null}</>;
`;

export const manualViews = [
	["component tag", "function View(ready) { return <Frame>{ready && <b />}</Frame>; }"],
	["earlier sibling", "function View(ready) { return <div>{read()} {ready && <b />}</div>; }"],
	["mapped item JSX", "const View = (items) => <ul>{items.map(item => <li>{item.visible && <b />}</li>)}</ul>;"],
	["direct eval", 'const View = () => <div>{eval("ready") ? <b /> : null}</div>;'],
] as const;

export const mixedView = conditionalView + retainedView.replace("function View", "function Items");
