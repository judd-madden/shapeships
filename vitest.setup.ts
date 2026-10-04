import { readFile } from 'node:fs/promises';
import { test } from 'vitest';

Object.assign(globalThis, {
    Deno: {
        test,
        readTextFile(path: URL): Promise<string> {
            return readFile(path, 'utf8');
        },
    },
});
