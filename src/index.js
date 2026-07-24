import Fastify from 'fastify'
import userRoutes from './routes/v1/users/index.js'
import artRoutes from './routes/v1/art/index.js'
import linkRoutes from './routes/v1/link/index.js'
import authRoutes from './routes/v1/auth/index.js' 
import fileRoutes from './routes/v1/file/index.js' 

import fastifyMultipart from '@fastify/multipart'  
import fastifyStatic from '@fastify/static'
import cors from '@fastify/cors'  // Добавьте импорт
import { PgObject } from 'pgobject'
import { Pool } from 'pg'
import dotenv from 'dotenv';
// Нужно для __dirname в ESM
import { fileURLToPath } from 'url'
import path from 'path'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const fastify = Fastify({
  logger: true
})

fastify.register(fastifyMultipart)

await fastify.register(cors, {
  origin: true, // Разрешить все источники (для разработки)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
})

// регистрируем static
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'files'), // папка со статикой
})

fastify.register(userRoutes, { prefix: '/api/v1/users' })
fastify.register(artRoutes, { prefix: '/api/v1/art' })
fastify.register(linkRoutes, { prefix: '/api/v1/links' })
fastify.register(authRoutes, { prefix: '/api/v1/auth' })
fastify.register(fileRoutes, { prefix: '/api/v1/file' })

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