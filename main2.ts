import * as fs from 'fs'
import { k_CEDICT_FILE_PATH, k_JMDICT_FILE_PATH, k_UNIHAN_DB_PATH } from "./consts";
import { Jmdict } from "./jmdict";
import * as xmlparser from './xmlparser';
import { ParamXMLElement, XMLParserProps, XMLDtdDecl } from './xmlparser';
import minimist from 'minimist';
import { Cedict } from './cedict';
import { Kanjidic } from './kanjidic';
import { Unihan } from './unihan';
import { buildKanjiMapFromFileList } from './buildKanjiMap';
import { k_SOURCE_FILE_LIST } from './file_list';



async function doThing() {
    const unihan = await Unihan.create(k_UNIHAN_DB_PATH);
    console.log(unihan.getEntry('中'));
    // const jmdict: Jmdict = await Jmdict.create(k_JMDICT_FILE_PATH);
    // console.log(jmdict.getNumEntries());
    // jmdict.forEachWord((w) => console.log(w));
}

// buildKanji();
doThing();
// console.log(splitAroundBoundaries('ELEMENT entry            "ent_seq, k_ele*, r_ele+, sense+"'));