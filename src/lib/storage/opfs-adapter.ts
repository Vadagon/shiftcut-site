// OPFS (Origin Private File System) adapter for large binary media.
// Interface adapted from OpenCut (MIT). Falls back to IndexedDB blob storage
// when OPFS is unavailable so small projects still work everywhere.

import { IndexedDBAdapter } from "./indexeddb-adapter";

async function opfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (navigator?.storage?.getDirectory) return await navigator.storage.getDirectory();
  } catch {
    /* ignore */
  }
  return null;
}

export class OPFSAdapter {
  private fallback: IndexedDBAdapter<Blob>;

  constructor(private dirName: string) {
    this.fallback = new IndexedDBAdapter<Blob>(`opfs-fallback-${dirName}`, "blobs");
  }

  private async dir(): Promise<FileSystemDirectoryHandle | null> {
    const root = await opfsRoot();
    if (!root) return null;
    return root.getDirectoryHandle(this.dirName, { create: true });
  }

  async writeFile(id: string, blob: Blob): Promise<void> {
    const dir = await this.dir();
    if (!dir) {
      await this.fallback.set(id, blob);
      return;
    }
    const handle = await dir.getFileHandle(id, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  async readFile(id: string): Promise<Blob | null> {
    const dir = await this.dir();
    if (!dir) return (await this.fallback.get(id)) ?? null;
    try {
      const handle = await dir.getFileHandle(id);
      return await handle.getFile();
    } catch {
      return null;
    }
  }

  async deleteFile(id: string): Promise<void> {
    const dir = await this.dir();
    if (!dir) {
      await this.fallback.remove(id);
      return;
    }
    try {
      await dir.removeEntry(id);
    } catch {
      /* ignore */
    }
  }
}
