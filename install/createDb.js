require('dotenv').config({ path: `${__dirname}/../.env` });
const { Client } = require('pg');

(async function run () {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        password: process.env.DB_PASS,
        port: process.env.DB_PORT,
    });

    try {
        client.connect();
        const result = await client.query(`CREATE DATABASE ${process.env.DB_NAME} WITH OWNER = ${process.env.DB_USER}`);
        console.log('SUCCSESS', result.command)
    } catch (e) {
        console.error('ERROR', e.stack)
    } finally {
        client.end()
    }
})();
