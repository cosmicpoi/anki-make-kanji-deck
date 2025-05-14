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
    const diff2 =[...jpList2].filter(c => !japaneseList.has(c));
    diff.sort();
    diff2.sort();
    // console.log(diff2.join(' '));

    // console.log(diff.join(' '));

    console.log([...jpList2].join(' '))

    // const { cnSorter, jpSorter } = getSorter({ unihan, bclu, bccwj });

    // const myChar = '好';

    // const jmdict = await Jmdict.create(k_JMDICT_FILE_PATH);
    // const entries = jmdict.getPreferredEntriesByChar(myChar);
    // entries.sort((e1, e2) => jpSorter(getPreferredReading(e1), getPreferredReading(e2)));

    // const unihanEntry = unihan.getEntry(myChar);
    // const charReadings: string[] = [...(unihanEntry?.cachedJapaneseKun || []), ...(unihanEntry?.cachedJapaneseOn || [])];

    // for (const entry of entries) {
    //     const entryReading = getPreferredReading(entry);
    //     const entryHiragana = getPreferredRele(entry);
    //     const entryRoma = wanakana.toRomaji(entryHiragana);
    //     const readingScores: Record<string, number> = {};
    //     charReadings.forEach(r => { readingScores[r] = Infinity; });
    //     charReadings.forEach((charReading) => {
    //         const charRoma = wanakana.toRomaji(charReading);
    //         const dist = minSubstrLevenshtein(charRoma, entryRoma);
    //         readingScores[charReading] = dist;
    //     });

    //     let minScore = Infinity;
    //     let bestReading = charReadings[0];
    //     charReadings.forEach((charReading) => {
    //         if (readingScores[charReading] < minScore) {
    //             minScore = readingScores[charReading];
    //             bestReading = charReading;
    //         }
    //     });

    //     const isOnyomi = wanakana.isKatakana(bestReading.at(0));
    //     console.log(entryReading, entryHiragana, bestReading, isOnyomi ? "on" : "kun");
    // }

    // const e1 = jmdict.getEntriesByWord('あからさま');
    // const e2 = jmdict.getEntriesByWord('白地');

    // console.log("E1");
    // console.dir(e1, {depth: null});
    // console.log("E2");
    // console.dir(e2, {depth: null});

    // if (e1 && e2) {
    //     e1.forEach(e => console.log(getPreferredReading(e)));
    //     e2.forEach(e => console.log(getPreferredReading(e)));
    // }

}
doThing()