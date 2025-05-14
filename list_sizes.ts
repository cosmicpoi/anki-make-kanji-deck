import * as fs from 'fs'
import * as readline from 'readline';

import autoBind from "auto-bind";
import { log_v } from './logging';
import { Bclu } from './Bclu';
import { k_BCCWJ_FILE_PATH, k_BCLU_FILE_PATH, k_CHARACTER_LIST_PATH, k_HANZIDB_FILE_PATH, k_JLPT_FILE_LIST, k_JMDICT_FILE_PATH, k_KANJIDIC_FILE_PATH, k_NUM_KANGXI_RADICALS, k_UNIHAN_DB_PATH } from './consts';
import { Kanjidic } from './kanjidic';
import { Hanzidb } from './Hanzidb';
import { areRadicalStrokesClose, Unihan } from './unihan';
import { isHanCharacter } from './types';
import { getPreferredKele, getPreferredReading, getPreferredRele, Jmdict } from './jmdict';
import { Bccwj } from './bccwj';
import { getSorter } from './freqCharSort';
import * as wanakana from 'wanakana';
import { minSubstrLevenshtein } from './levenshtein';

async function doThing() {
    const kanjidic = await Kanjidic.create(k_KANJIDIC_FILE_PATH);
    const unihan = await Unihan.create(k_UNIHAN_DB_PATH);
    // const bccwj = await Bccwj.create(k_BCCWJ_FILE_PATH);
    // const bclu = await Bclu.create(k_BCLU_FILE_PATH);

    const japaneseList: Set<string> = new Set(kanjidic.getJLPTChars());
    const jpList2: Set<string> = new Set();

    for (const file of k_JLPT_FILE_LIST) {
        const content = fs.readFileSync(k_CHARACTER_LIST_PATH + '/' + file, 'utf-8');
        const chars = content.split('\n').filter(e => e != '');
        chars.forEach(c => jpList2.add(c));
    }

    const smallerList = japaneseList.size < jpList2.size  ? japaneseList : jpList2;
    const biggerList = japaneseList.size > jpList2.size  ? japaneseList : jpList2;

    console.log(japaneseList < jpList2 ? "Kanjidic list smaller" : "joyo list smaller");
    console.log(japaneseList.size, jpList2.size);
    const diff = [...biggerList].filter(c => !smallerList.has(c));

    console.log(diff);


}
doThing()