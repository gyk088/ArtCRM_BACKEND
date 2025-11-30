require('dotenv').config({ path: `${__dirname}/../.env` });
const { Client } = require('pg');
const { readdirSync, readFileSync, writeFileSync } = require('fs');

const step = process.argv[2];
const force = process.argv[3];
const complitedFileName = `${__dirname}/complitedSteps.txt`

const files = readdirSync(`${__dirname}/steps`).sort((a,b) => {
    const numA = parseInt(a.split('.')[0])
    const numB = parseInt(b.split('.')[0])
    if (numA > numB) return 1
    if (numA < numB) return -1
    return 0
});

const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

run();

async function exeQuery(file) {
    try {
        if (isStepCopmlited(file)) return;
        const queryStr = readFileSync(`${__dirname}/steps/${file}`, 'utf8');
        await client.query(queryStr.replace(/@@DBUSER@@/g, process.env.DB_USER));
        console.info(`step ${file} completed`);
        writeFileSync(complitedFileName, `${file}\n`, {flag: "a+"})
    } catch (e) {
        console.error(`step ${file} failed`, e);
    }
};

function isStepCopmlited(file) {
    if (force === 'force') return false;
    try {
        const str = readFileSync(complitedFileName, 'utf8');
        const complitedFiles = str.split('\n');
        const check = complitedFiles.includes(file);
        if (check) {
            console.info(`step ${file} is already completed`);
        };

        return check;
    } catch (e) {
        return false;
    }
}

async function runOneStep(number) {
    if (files.includes(`${number}.sql`)) {
        await exeQuery(`${number}.sql`);
    } else {
        console.error('ERROR', `No such step ${number}`);
    }
}

async function runAllSteps() {
    for (const f of files) {
        await exeQuery(f)
    }
}

async function run() {
    client.connect();

    if (step === 'all') {
        await runAllSteps();
    } else if (parseInt(step, 10)) {
        await runOneStep(parseInt(step, 10));
    } else {
        console.log('to start the migration please enter the number (node migration.js 1) \nor "all" for run all migrations (node migration.js all)')
    }

    client.end();
};