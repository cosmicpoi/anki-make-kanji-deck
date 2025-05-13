import * as fs from 'fs'
import * as readline from 'readline';

import autoBind from "auto-bind";
import { log_v } from './logging';
import { Bclu } from './Bclu';
import { k_HANZIDB_FILE_PATH, k_KANJIDIC_FILE_PATH } from './consts';
import { Kanjidic } from './kanjidic';
import { Hanzidb } from './Hanzidb';

async function doThing() {
    const kanjidic = await Kanjidic.create(k_KANJIDIC_FILE_PATH);
    // console.log(kanjidic.getJLPTChars()) ;
    const hanzidb = await Hanzidb.create(k_HANZIDB_FILE_PATH);
    // hanzidb.forEachEntry(e => console.log(e));
    // console.log(hanzidb.getHSKChars());
    // console.log(hanzidb.getHSKChars().length);
    console.log(kanjidic.getNMostFrequent(3000));
    console.log(kanjidic.getNMostFrequent(3000).length);
}
doThing()