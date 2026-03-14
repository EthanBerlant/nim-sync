export interface AtomicWriteOptions {
    backup?: boolean;
    createBackupDir?: boolean;
}
export declare function readJSONC<T = unknown>(filePath: string): Promise<T>;
export declare function writeJSONC<T = unknown>(filePath: string, data: T, options?: AtomicWriteOptions): Promise<void>;
export declare function atomicWrite(filePath: string, content: string, options?: AtomicWriteOptions): Promise<void>;
export declare function ensureDir(dirPath: string): Promise<void>;
export declare function getConfigDir(): string;
export declare function getCacheDir(): string;
export declare function acquireLock(lockName: string, timeoutMs?: number): Promise<() => void>;
//# sourceMappingURL=file-utils.d.ts.map