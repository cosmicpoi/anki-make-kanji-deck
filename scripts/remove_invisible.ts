import * as fs from 'fs'
import minimist from "minimist";
const args = minimist(process.argv.slice(2));

if (!args['o'] || !args['i']) {
    console.log("Specify input -i and output -o files")
    process.exit(1);
}

const inputPath = args['i'];
const outputPath = args['o'];

// Regex to match all known zero-width characters
const invisibleChars = /[\u200B\u200C\u200D\u2060\uFEFF]/g;

const content = fs.readFileSync(inputPath, 'utf8');
const cleaned = content.replace(invisibleChars, '');

fs.writeFileSync(outputPath, cleaned, 'utf8');

console.log('Invisible characters removed.');