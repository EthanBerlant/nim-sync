import type { PluginAPI } from '../types/index.js';
export declare function createMockPluginAPI(overrides?: Partial<PluginAPI>): PluginAPI;
export declare function mockFileSystem(): {
    readFile: import("vitest").Mock<any, any>;
    writeFile: import("vitest").Mock<any, any>;
    mkdir: import("vitest").Mock<any, any>;
    rename: import("vitest").Mock<any, any>;
    unlink: import("vitest").Mock<any, any>;
    open: import("vitest").Mock<any, any>;
    copyFile: import("vitest").Mock<any, any>;
};
//# sourceMappingURL=mocks.d.ts.map