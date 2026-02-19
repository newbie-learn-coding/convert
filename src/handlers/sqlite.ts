import CommonFormats from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

class sqlite3Handler implements FormatHandler {

  public name: string = "sqlite3";
  public supportedFormats?: FileFormat[];
  public ready: boolean = false;

  async init () {
    this.supportedFormats = [
      {
        name: "SQLite3",
        format: "sqlite3",
        extension: "db",
        mime: "application/vnd.sqlite3",
        from: true,
        to: false,
        internal: "sqlite3",
        category: "database"
      },
      // Lossy because extracts only tables  
      CommonFormats.CSV.builder("csv").allowTo()
    ];
    this.ready = true;
  }

  /**
   * Validates that a table name is a valid SQLite identifier.
   * Prevents SQL injection by rejecting names with special characters.
   */
  private isValidTableName(name: string): boolean {
    // SQLite identifiers must start with letter/underscore, followed by alphanumeric/underscore
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }

  /**
   * Escapes a table name for safe use in SQL queries.
   * Double quotes are used for identifier quoting in SQLite.
   */
  private escapeIdentifier(name: string): string {
    if (!this.isValidTableName(name)) {
      throw new Error(`Invalid table name: ${name}`);
    }
    // Escape any double quotes by doubling them
    return `"${name.replace(/"/g, '""')}"`;
  }

  getTables(db: any): string[] {
    const stmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table';");
    const tables: string[] = [];
    try {
      while (stmt.step()) {
        const tableName = stmt.get(0);
        if (typeof tableName === 'string' && this.isValidTableName(tableName)) {
          tables.push(tableName);
        }
      }
    } finally {
        stmt.finalize();
    }
    return tables;
  }

  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];

    if (inputFormat.internal !== "sqlite3" || outputFormat.internal !== "csv") {
      throw new Error(`Unsupported conversion: ${inputFormat.internal} to ${outputFormat.internal}`);
    }

    const sqlite3 = await sqlite3InitModule();

    for (const file of inputFiles) {
      const p = sqlite3.wasm.allocFromTypedArray(file.bytes);
      const db = new sqlite3.oo1.DB();

      try {
        if (!db.pointer) {
          throw new Error("Database pointer is undefined");
        }

        const flags = sqlite3.capi.SQLITE_DESERIALIZE_FREEONCLOSE;
        const rc = sqlite3.capi.sqlite3_deserialize(
          db.pointer,
          "main",
          p,
          file.bytes.byteLength,
          file.bytes.byteLength,
          flags
        );
        db.checkRc(rc);

        for (const table of this.getTables(db)) {
          const escapedTable = this.escapeIdentifier(table);
          const stmt = db.prepare(`SELECT * FROM ${escapedTable}`);
          let csvStr = stmt.getColumnNames().join(",") + "\n";
          try {
            while (stmt.step()) {
              const row = Array.from({ length: stmt.columnCount }, (_, j) => stmt.get(j));
              csvStr += row.join(", ") + "\n";
            }
          } finally {
            stmt.finalize();
          }

          const encoder = new TextEncoder();
          outputFiles.push({
            name: `${table}.csv`,
            bytes: new Uint8Array(encoder.encode(csvStr))
          });
        }
      } finally {
        // Ensure database is closed and WASM memory is freed
        if (db.pointer) {
          db.close();
        }
        // Note: With SQLITE_DESERIALIZE_FREEONCLOSE, the memory is freed when db is closed
      }
    }

    return outputFiles;
  }

}

export default sqlite3Handler;
