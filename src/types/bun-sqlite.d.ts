declare module "bun:sqlite" {
  export class Database {
    constructor(filename: string, options?: { create?: boolean; readonly?: boolean });
    query<T = any>(sql: string): Statement<T>;
    prepare<T = any>(sql: string): Statement<T>;
    exec(sql: string): void;
    close(): void;
    serialize(): Uint8Array;
  }

  export class Statement<T = any> {
    run(...params: any[]): void;
    get(...params: any[]): T | null;
    all(...params: any[]): T[];
    values(...params: any[]): any[][];
    finalize(): void;
  }
}
