import type { RowDataPacket } from "mysql2/promise";
import { getDbPool } from "./db";

export type NoticiaRow = {
  id: number;
  fecha: string;
  titulo: string;
  contenido: string;
  imagen: string | null;
};

export async function fetchNoticias(limit?: number): Promise<NoticiaRow[]> {
  const pool = getDbPool();
  const lim = typeof limit === "number" ? Math.max(1, Math.min(50, limit)) : undefined;

  const sql = `
    SELECT id, fecha, titulo, contenido, imagen
    FROM noticias
    ORDER BY fecha DESC
    ${lim ? "LIMIT ?" : ""}
  `;

  const [rows] = await pool.query<RowDataPacket[]>(sql, lim ? [lim] : []);
  return rows as unknown as NoticiaRow[];
}

export async function fetchNoticiaById(id: number): Promise<NoticiaRow | null> {
  const pool = getDbPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `
      SELECT id, fecha, titulo, contenido, imagen
      FROM noticias
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  const r = (rows as unknown as NoticiaRow[])[0];
  return r ?? null;
}
