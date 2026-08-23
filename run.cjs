const util = require('util');
const exec = util.promisify(require('child_process').exec);

const step1 = "pm2 start npm --name artcrm-backend -- run start"

async function run() {
    try {
        const { stdout, stderr } = await exec(step1);
        console.log('stdout:', stdout);
        console.log('stderr:', stderr);
    } catch (e) {
        console.error(e); // should contain code (exit code) and signal (that caused the termination).
    }
}

run()
