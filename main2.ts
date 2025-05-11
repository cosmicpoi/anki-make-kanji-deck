import * as fs from 'fs'
import { k_JMDICT_FILE_PATH } from "./consts";
import { Jmdict } from "./jmdict";

async function doThing() {
    const jmdict = await Jmdict.create(k_JMDICT_FILE_PATH);
    if (!jmdict) return;

    const filepath = 'output/test_all_japanese_words.txt';
    const writeStream = fs.createWriteStream(filepath, { flags: 'w', encoding: 'utf8' });
    jmdict.forEachWord((w) => {
        // console.log(w);
        const ok = writeStream.write(w + '\n');

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

doThing();