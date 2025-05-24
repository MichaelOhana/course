import { DB_FILE_PATH, SQL_JS_CDN_PATH } from './config.js';

export async function initDB() {
    try {
        console.log("Loading SQL.js WASM...");
        // Ensure initSqlJs is available globally or imported if SQL.js provides an ES module version
        const SQL = await window.initSqlJs({ locateFile: file => `${SQL_JS_CDN_PATH}${file}` });

        console.log("Fetching database file:", DB_FILE_PATH);
        const dbResponse = await fetch(DB_FILE_PATH);
        if (!dbResponse.ok) {
            throw new Error(`Failed to fetch database: ${dbResponse.statusText}`);
        }
        const dbFileArrayBuffer = await dbResponse.arrayBuffer();

        console.log("Creating database instance...");
        this.db = new SQL.Database(new Uint8Array(dbFileArrayBuffer));
        console.log("Database loaded successfully.");
    } catch (err) {
        console.error("Database initialization error:", err);
        this.error = (this.error ? this.error + '; ' : '') + (err.message || "An unknown error occurred during DB initialization.");
        throw err; // Re-throw to be caught by main init
    }
}

export function executeQuery(sql, params = []) {
    if (!this.db) {
        console.error("Database not initialized.");
        this.error = "Database not initialized. Cannot execute query.";
        return null;
    }
    try {
        const stmt = this.db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    } catch (e) {
        console.error("Error executing query:", sql, e);
        this.error = `Query failed: ${e.message}`;
        return null;
    }
} 