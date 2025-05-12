import * as fs from 'fs'
import { k_CEDICT_FILE_PATH, k_JMDICT_FILE_PATH } from "./consts";
import { Jmdict } from "./jmdict";
import * as xmlparser from './xmlparser';
import { ParamXMLElement, XMLParserProps, XMLDtdDecl } from './xmlparser';
import minimist from 'minimist';
import { Cedict } from './cedict';
import { Kanjidic } from './kanjidic';
import { Unihan } from './unihan';
import { buildKanjiMapFromFileList } from './buildKanjiMap';
import { k_SOURCE_FILE_LIST } from './file_list';

const args = minimist(process.argv.slice(2));
function buildKanji() {
    const unihan = new Unihan();
    const kanjidic = new Kanjidic();
    const cedict = new Cedict(k_CEDICT_FILE_PATH);

    const kanji: KanjiMap = buildKanjiMapFromFileList(k_SOURCE_FILE_LIST, { unihan, kanjidic, cedict });
}

async function doThing() {
    const jmdict: Jmdict = await Jmdict.create(k_JMDICT_FILE_PATH);

    jmdict.forEachWord((w) => console.log(w));
}

buildKanji();
// doThing();
// console.log(splitAroundBoundaries('ELEMENT entry            "ent_seq, k_ele*, r_ele+, sense+"'));