import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getDbPool() {
  if (pool) return pool;

  const cfg = useRuntimeConfig();
  pool = mysql.createPool({
    host: cfg.dbHost,
    port: cfg.dbPort,
    user: cfg.dbUser,
    password: cfg.dbPassword,
    database: cfg.dbName,
    connectionLimit: 10,
    timezone: "Z"
  });

  return pool;
}
