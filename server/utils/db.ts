// server/utils/db.ts
import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

export function getDbPool() {
  if (pool) return pool

  const config = useRuntimeConfig()

  pool = mysql.createPool({
    host: config.dbHost,
    port: Number(config.dbPort),
    database: config.dbName,
    user: config.dbUser,
    password: config.dbPassword,
    waitForConnections: true,
    connectionLimit: 10,
  })

  return pool
}
