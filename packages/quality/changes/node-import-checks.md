### Changed

- The Biome preset now reports a bare `process` global (`noProcessGlobal`) and a JSON import without `with { type: "json" }` (`useJsonImportAttributes`) as errors. Their automatic fixes stay disabled because Biome's own fixes hang or emit invalid syntax: `quality lint` reports them and the author repairs them by hand.
