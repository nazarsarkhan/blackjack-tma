const { BlackjackDatabase, DEFAULT_DB_PATH } = require("../src/db");

const db = new BlackjackDatabase();
db.close();

console.log(`SQLite database initialized at ${DEFAULT_DB_PATH}`);
