import * as fs from 'fs'
import * as readline from 'readline';

import autoBind from "auto-bind";
import { log_v } from './logging';
import { Bclu } from './Bclu';
import { k_BCCWJ_FILE_PATH, k_BCLU_FILE_PATH, k_CEDICT_FILE_PATH, k_CHARACTER_LIST_PATH, k_HANZIDB_FILE_PATH, k_JLPT_FILE_LIST, k_JMDICT_FILE_PATH, k_KANJIDIC_FILE_PATH, k_NUM_KANGXI_RADICALS, k_SUBTLEX_FILE_PATH, k_UNIHAN_DB_PATH } from './consts';
import { Kanjidic } from './kanjidic';
import { Hanzidb } from './Hanzidb';
import { areRadicalStrokesClose, Unihan } from './unihan';
import { isHanCharacter } from './types';
import { getPreferredKele, getPreferredReading, getPreferredRele, Jmdict } from './jmdict';
import { Bccwj } from './bccwj';
import { getCnSorter, getSorter } from './freqCharSort';
import * as wanakana from 'wanakana';
import { minSubstrLevenshtein } from './levenshtein';
import { Cedict } from './cedict';
import { Subtlex } from './Subtlex';

// function getChineseVocab(
//     mychar: string,
//     modules: {
//         cedict: Cedict,
//         unihan: Unihan,
//         bclu: Bclu
//     },
// ): string[] {

//     const { bclu, unihan, cedict } = modules;
//     const { cnSorter } = getCnSorter({ unihan, bclu });

//     const entries = cedict.getVocabEntriesForChar(mychar);
//     const words = entries.map(e => e.simplified);
//     words.sort(cnSorter);
//     return words;
// }

async function doThing() {
    const subltex = await Subtlex.create(k_SUBTLEX_FILE_PATH);
    // const cedict = await Cedict.create(k_CEDICT_FILE_PATH);
    // const unihan = await Unihan.create(k_UNIHAN_DB_PATH);
    // const bclu = await Bclu.create(k_BCLU_FILE_PATH);
    // const vocab = getChineseVocab('好', { cedict, unihan, bclu });

    // console.log(vocab);

}
doThing()