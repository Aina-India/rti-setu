// templates-index.js
// Single place that enumerates all template packs. The engine and app read
// TEMPLATE_PACKS rather than hard-coding pack filenames. Add a new category by
// importing its pack module and pushing it here — nothing else changes.

import educationPack from "./templates-education.js";

export const TEMPLATE_PACKS = [
  educationPack
  // future: financePack, environmentPack, centralServicesPack …
];
