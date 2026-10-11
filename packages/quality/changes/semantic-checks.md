### Changed

- Report misused promises, missing explicit switch cases and loose null equality as errors in the shared Biome preset. Leave their fixes disabled so authors retain promise ownership, fallback behavior and checks for both null and undefined.
