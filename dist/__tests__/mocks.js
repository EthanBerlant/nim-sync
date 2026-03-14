import { vi } from 'vitest';
export function createMockPluginAPI(overrides) {
    return {
        config: {
            get: vi.fn(),
            set: vi.fn()
        },
        tui: {
            toast: {
                show: vi.fn()
            }
        },
        command: {
            register: vi.fn(),
            execute: vi.fn()
        },
        ...overrides
    };
}
export function mockFileSystem() {
    const fsMock = {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        mkdir: vi.fn(),
        rename: vi.fn(),
        unlink: vi.fn(),
        open: vi.fn(),
        copyFile: vi.fn()
    };
    vi.doMock('fs/promises', () => fsMock);
    vi.doMock('path', () => ({
        join: (...args) => args.join('/'),
        dirname: (p) => p.split('/').slice(0, -1).join('/'),
        basename: (p) => p.split('/').pop()
    }));
    vi.doMock('crypto', () => ({
        createHash: (algorithm) => ({
            update: (data) => ({
                digest: (encoding) => {
                    // Simple hash for testing that different inputs produce different outputs
                    const models = JSON.parse(data);
                    const modelIds = models.map((m) => m.id).sort().join(',');
                    return `hash-${modelIds.length}-${algorithm}-${encoding}`;
                }
            })
        })
    }));
    return fsMock;
}
//# sourceMappingURL=mocks.js.map