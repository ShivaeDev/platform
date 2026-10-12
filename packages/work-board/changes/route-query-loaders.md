### Changed

- Board route loaders read document and workspace page queries through `effect-react` in the shell's native registry. Preloading shares cached reads with navigation, and the displayed page stays mounted while the next read settles.
