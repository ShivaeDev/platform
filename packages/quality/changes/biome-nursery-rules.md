### Changed

- Enable Biome's `noSelfImport`, `noReactObjectTypeAsDefaultProp`, `noMisplacedListElements` and `usePromiseRejectErrors` rules in the shared preset. A repository now fails the gate on a module that imports itself, a React component whose prop default is an array, object or function literal, an `<li>` outside `<ul>`, `<ol>` or `<menu>`, and a promise rejected with something other than an `Error`.
