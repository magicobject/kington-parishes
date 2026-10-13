// Fixture themes in the unit tests are built from the real theme, but the three LAUNCH FLAGS are pinned to false here, so
// flipping the real flags at launch (goLive, publicListing, artRequired) cannot change what these tests build.
// Tests of the real flags themselves (advent-launch-flags, advent-prelaunch) read the real theme directly.
export const pinFlags = (theme) => ({ ...theme, goLive: false, publicListing: false, artRequired: false });
