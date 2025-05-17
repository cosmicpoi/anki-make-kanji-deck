import * as fs from 'fs'

import { Kanjidic } from 'Kanjidic';
import { Unihan } from "Unihan";
import { k_CHARACTER_LIST_PATH, k_JLPT_FILE_LIST, k_KANJIDIC_FILE_PATH, k_UNIHAN_DB_PATH } from 'consts/consts';

async function doThing() {
    const kanjidic = await Kanjidic.create(k_KANJIDIC_FILE_PATH);
    // const bccwj = await Bccwj.create(k_BCCWJ_FILE_PATH);
    // const bclu = await Bclu.create(k_BCLU_FILE_PATH);

    const kanjidiclist: Set<string> = new Set(kanjidic.getJLPTChars());

    const content = fs.readFileSync(k_CHARACTER_LIST_PATH + '/' + 'Joyo_all.txt', 'utf-8');
    const joyolist: Set<string> = new Set(content.split('\n').filter(e => e != ''));


    console.log("Elements in kanjidic list not in joyo list:");
    console.log( [...kanjidiclist].filter(c => !joyolist.has(c)) );
    console.log("Elements in joyo list not in kanjidic list:");
    console.log( [...joyolist].filter(c => !kanjidiclist.has(c)) );
}
doThing()