/**
 * Efficiently index tree positions in a large file.
 * Ported from treev.py TreeIndexer class.
 *
 * For files with millions of trees, we store byte offsets
 * to allow random access without loading all trees into memory.
 */

export interface IndexProgress {
  indexed: number;
  total: number;
  phase: 'scanning' | 'complete';
}

export type ProgressCallback = (progress: IndexProgress) => void;

export class FileIndexer {
  private file: File;
  private treeOffsets: number[] = [];
  private fileSize: number = 0;
  private indexed: boolean = false;
  private skipFirstLine: boolean = false;

  constructor(file: File, options?: { skipFirstLine?: boolean }) {
    this.file = file;
    this.fileSize = file.size;
    this.skipFirstLine = options?.skipFirstLine ?? false;
  }

  /**
   * Index the file by finding byte offsets of each line.
   * Reads the file in chunks to handle large files efficiently.
   */
  async index(onProgress?: ProgressCallback): Promise<void> {
    const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for faster reading
    this.treeOffsets = [0];

    let offset = 0;
    let lastProgressUpdate = 0;

    while (offset < this.fileSize) {
      const end = Math.min(offset + CHUNK_SIZE, this.fileSize);
      const chunk = this.file.slice(offset, end);
      const buffer = await chunk.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Find newlines (byte 10) and record offsets
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 10) { // newline character
          const nextLineOffset = offset + i + 1;
          if (nextLineOffset < this.fileSize) {
            this.treeOffsets.push(nextLineOffset);
          }
        }
      }

      offset = end;

      // Throttle progress updates
      if (onProgress && offset - lastProgressUpdate > 5000000) {
        lastProgressUpdate = offset;
        onProgress({
          indexed: this.treeOffsets.length,
          total: Math.ceil(this.fileSize / 150),
          phase: 'scanning'
        });
      }
    }

    // Remove any trailing empty line offset
    if (this.treeOffsets.length > 0 &&
        this.treeOffsets[this.treeOffsets.length - 1] >= this.fileSize) {
      this.treeOffsets.pop();
    }

    // Skip first line if requested (e.g., for species tree files with starting tree)
    if (this.skipFirstLine && this.treeOffsets.length > 0) {
      this.treeOffsets.shift();
    }

    this.indexed = true;

    if (onProgress) {
      onProgress({
        indexed: this.treeOffsets.length,
        total: this.treeOffsets.length,
        phase: 'complete'
      });
    }
  }

  /**
   * Get total number of trees in the file.
   */
  getTreeCount(): number {
    return this.treeOffsets.length;
  }

  /**
   * Retrieve tree string at given index.
   */
  async getTree(index: number): Promise<string> {
    if (index < 0 || index >= this.treeOffsets.length) {
      return '';
    }

    const startOffset = this.treeOffsets[index];
    const endOffset = index + 1 < this.treeOffsets.length
      ? this.treeOffsets[index + 1]
      : this.fileSize;

    const chunk = this.file.slice(startOffset, endOffset);
    const text = await chunk.text();

    return text.trim();
  }

  /**
   * Check if file has been indexed.
   */
  isIndexed(): boolean {
    return this.indexed;
  }

  /**
   * Get the filename.
   */
  getFilename(): string {
    return this.file.name;
  }
}
