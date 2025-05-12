import minimist from "minimist";
import { buildKanjiMapFromFileList } from "./buildKanjiMap";
import { Cedict } from "./cedict";
import { k_CEDICT_FILE_PATH, k_JMDICT_FILE_PATH, k_KANJIDIC_FILE_PATH, k_UNIHAN_DB_PATH } from "./consts";
import { k_SOURCE_FILE_LIST } from "./file_list";
import { Kanjidic } from "./kanjidic";
import { KanjiMap } from "./KanjiMap";
import { Unihan } from "./unihan";
import { getPreferredReading, Jmdict, JmdictEntry } from "./jmdict";
import autoBind from "auto-bind";
import { isHanCharacter } from "./types";

const args = minimist(process.argv.slice(2));

// Annotate jmdict entries with which kanji they have
class CharIndex {
    constructor() {
        autoBind(this);
    }

    public annotateDictEntry(entry: JmdictEntry) {

    }

    private m_seqToKanji: Map<number, string[]> = new Map();
    private m_kanjiToSec: Map<string, number[]> = new Map();
}


async function buildKanji() {
    const unihan = new Unihan(k_UNIHAN_DB_PATH);
    const kanjidic = new Kanjidic(k_KANJIDIC_FILE_PATH);
    const cedict = new Cedict(k_CEDICT_FILE_PATH);

    // Populate transliterations and readings
    const kanji: KanjiMap = buildKanjiMapFromFileList(k_SOURCE_FILE_LIST, { unihan, kanjidic, cedict });

    if (args['o']) {
        kanji.writeToFile(args['o']);
    }

    // const jmdict: Jmdict = await Jmdict.create(k_JMDICT_FILE_PATH);
    const jmdict: Jmdict = await Jmdict.create('test_xml.xml');

    // scratchwork -------------------
    jmdict.forEachWord((word: string) => {
        const entry = jmdict.getEntry(word);
        if (!entry) return
        if (entry.k_ele.length == 0) return;


        const [pref, score] = getPreferredReading(entry);

        const wordKanji = new Set<string>();
        for (const mychar of pref) {
            if (isHanCharacter(mychar)) wordKanji.add(mychar);
        }
        console.log(`${pref} has kanji ` + [...wordKanji]);




    });
}

buildKanji();