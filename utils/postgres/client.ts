import postgres from "postgres";

const connectionString = process.env.LOCAL_DATABASE_URL || "postgresql://postgres:uzij1a12sb1p10vq@dokploy-postgres:5432/postgres";

// Evitar fugas y agotamiento de conexiones en desarrollo al usar Fast Refresh en Next.js
const globalForPostgres = global as unknown as {
  sql: postgres.Sql | undefined;
};

export const sql =
  globalForPostgres.sql ||
  postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPostgres.sql = sql;
}
