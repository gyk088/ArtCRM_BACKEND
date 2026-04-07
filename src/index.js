import Fastify from 'fastify'
import userRoutes from './routes/v1/users/index.js'
import artRoutes from './routes/v1/art/index.js'
import { PgObject } from 'pgobject'
import { Pool } from 'pg'
import dotenv from 'dotenv';
dotenv.config();

const fastify = Fastify({
  logger: true
})

fastify.register(userRoutes, { prefix: 'api/v1/users' })
fastify.register(artRoutes, { prefix: 'api/v1/art' })

function connectToDatabase() {
  console.log('Connecting to database...', process.env.DB_USER);
  const client = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
  });
  console.log('Connecting to database...', client);
  PgObject.setClient(client);
  PgObject.setLog(true);
}

// запуск сервера
const start = async () => {
  try {
    connectToDatabase();
    await fastify.listen({ port: process.env.FASTIFY_PORT, host: '0.0.0.0' })
    console.log(`Server is running on http://localhost:${process.env.FASTIFY_PORT}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()