import minimist from "minimist";
import { buildKanjiMapFromFileList } from "./buildKanjiMap";
import { Cedict } from "./cedict";
import { k_CEDICT_FILE_PATH, k_KANJIDIC_FILE_PATH, k_UNIHAN_DB_PATH } from "./consts";
import { k_SOURCE_FILE_LIST } from "./file_list";
import { Kanjidic } from "./kanjidic";
import { KanjiMap } from "./KanjiMap";
import { Unihan } from "./unihan";

const args = minimist(process.argv.slice(2));
function buildKanji() {
    const unihan = new Unihan(k_UNIHAN_DB_PATH);
    const kanjidic = new Kanjidic(k_KANJIDIC_FILE_PATH);
    const cedict = new Cedict(k_CEDICT_FILE_PATH);

    const kanji: KanjiMap = buildKanjiMapFromFileList(k_SOURCE_FILE_LIST, { unihan, kanjidic, cedict });

    if (args['o']) {
        kanji.writeToFile(args['o']);
    }
}

buildKanji();