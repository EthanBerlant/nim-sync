import type { Plugin } from "./types/index.js";
import { syncNIMModels } from "./plugin/nim-sync.js";

export default syncNIMModels as Plugin;
