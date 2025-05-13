import minimist from "minimist";
import { buildKanjiMapFromFileLists } from "./buildKanjiMap";
import { Cedict } from "./cedict";
import { k_BCCWJ_FILE_PATH, k_CEDICT_FILE_PATH, k_CHARACTER_LIST_PATH, k_HSK_FILE_LIST, k_JLPT_FILE_LIST, k_JMDICT_FILE_PATH, k_KANJIDIC_FILE_PATH, k_UNIHAN_DB_PATH } from "./consts";
import { Kanjidic } from "./kanjidic";
import { KanjiMap } from "./KanjiMap";
import { Unihan } from "./unihan";
import { getPreferredReading, Jmdict, JmdictEntry } from "./jmdict";
import autoBind from "auto-bind";
import { fuzzy_empty, isHanCharacter, KanjiCard_Fuzzy } from "./types";
import { Bccwj } from "./bccwj";

const args = minimist(process.argv.slice(2));

async function buildKanji() {
    const unihan = await Unihan.create(k_UNIHAN_DB_PATH);
    const kanjidic = new Kanjidic(k_KANJIDIC_FILE_PATH);
    const cedict = new Cedict(k_CEDICT_FILE_PATH);

    // Populate transliterations and readings
    const kanji: KanjiMap = buildKanjiMapFromFileLists({
        fileListDir: k_CHARACTER_LIST_PATH,
        japaneseList: k_JLPT_FILE_LIST,
        simpChineseList: k_HSK_FILE_LIST,
        modules: { unihan, kanjidic, cedict }
    });



}

buildKanji();