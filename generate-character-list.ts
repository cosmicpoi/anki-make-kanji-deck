//
// Generate a list of all chinese/japanese characters
//


import * as fs from 'fs'
import minimist from "minimist";
import { Cedict } from "./cedict";
import { k_CEDICT_FILE_PATH } from "./consts";
import { Kanjidic } from "./kanjidic";
import { Unihan } from "./unihan";
import { isHanCharacter } from './types';

const unihan = new Unihan();
const kanjidic = new Kanjidic();
const cedict = new Cedict(k_CEDICT_FILE_PATH);

const args = minimist(process.argv.slice(2));

function writeCharsToFile(chars: string[], filepath: string) {
    const writeStream = fs.createWriteStream(filepath, {
        flags: 'w', // 'a' to append
        encoding: 'utf8'
    });

    // const chars = [''];
    chars.forEach((mychar) => {
        const ok = writeStream.write(mychar + '\n');

        if (!ok) {
            // Stream buffer is full, wait for drain before continuing
            writeStream.once('drain', () => {
                console.log('Drain event triggered, resuming writes...');
            });
        }
    });

    writeStream.end(() => {
        console.log('Finished writing file.');
    });
}

if (args['c']) {
    const path = args['c'];
    console.log("Writing chinese characters to file", path);

    const keys = cedict.getKeys()
        .filter(w => w.length == 1)
        .filter(c => isHanCharacter(c));
    
    writeCharsToFile(keys, path);
}

if (args['j']) {
    const path = args['j'];
    console.log("Writing japanese characters to file", path);
    
    writeCharsToFile(kanjidic.getChars(), path);
}