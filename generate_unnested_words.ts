import * as fs from 'fs'
import minimist from "minimist";

const args = minimist(process.argv.slice(2));
if (!args['o'] || !args['i']) {
    console.error("Invalid arguments. Format: -i <in directory> -o <out directory>");
    process.exit(1);
}
const inPath: string = args['i'];
const outPath: string = args['o'];

const nestingOrder: string[] = [
    'Japanese_Basic.txt',
    'JLPT_N1.txt',
    'JLPT_N2.txt',
    'JLPT_N3.txt',
    'JLPT_N4.txt',
    'JLPT_N5.txt',
];

const fileContents: Set<string>[] = nestingOrder.map(() => new Set());

// Load base chars
for (let i = 0; i < nestingOrder.length; i++) {
    const filepath = inPath + "/" + nestingOrder[i];
    const content = fs.readFileSync(filepath, 'utf-8');
    const chars = content.split("\n").filter(s => s.length != 0);
    fileContents[i] = new Set(chars);
};

console.log(fileContents.map(s => s.size));

// Subtract chars
const subtractedContents: Set<string>[] = nestingOrder.map(() => new Set());
for (let i = 0; i < nestingOrder.length - 1; i++) {
    const difference = new Set([...fileContents[i]].filter(e => !fileContents[i + 1].has(e)));
    subtractedContents[i] = difference;
};
subtractedContents[nestingOrder.length - 1] = fileContents[nestingOrder.length - 1];

console.log(subtractedContents.map(s => s.size));

// Write to file
for (let i = 0; i < nestingOrder.length; i++) {
    const filepath = outPath + "/" + nestingOrder[i];
    const writeStream = fs.createWriteStream(filepath, { flags: 'w', encoding: 'utf8' });

    subtractedContents[i].forEach((mychar) => {
        const ok = writeStream.write(mychar + '\n');

        if (!ok) {
            // Stream buffer is full, wait for drain before continuing
            writeStream.once('drain', () => {
                console.log('Drain event triggered, resuming writes...');
            });
        }
    });

    writeStream.end(() => {
        console.log('Finished writing file.', filepath);
    });
}