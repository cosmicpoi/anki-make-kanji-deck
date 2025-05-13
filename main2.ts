import minimist from "minimist";
import { buildKanjiMapFromFileList } from "./buildKanjiCards";
import { Cedict } from "./cedict";
import { k_BCCWJ_FILE_PATH, k_CEDICT_FILE_PATH, k_JMDICT_FILE_PATH, k_KANJIDIC_FILE_PATH, k_UNIHAN_DB_PATH } from "./consts";
import { k_SOURCE_FILE_LIST } from "./file_list";
import { Kanjidic } from "./kanjidic";
import { KanjiMap } from "./KanjiMap";
import { Unihan } from "./unihan";
import { getPreferredReading, Jmdict, JmdictEntry } from "./jmdict";
import autoBind from "auto-bind";
import { fuzzy_empty, isHanCharacter, KanjiCard_Fuzzy } from "./types";
import { Bccwj } from "./bccwj";

const args = minimist(process.argv.slice(2));

// Annotate jmdict entries with which kanji they have
class CharIndex {
    constructor() {
        autoBind(this);
    }

    public annotateDictEntry(entry: JmdictEntry) {
        if (entry.k_ele.length == 0) return;

        const [pref, score] = getPreferredReading(entry);

        const wordKanji = new Set<string>();
        for (const mychar of pref) {
            if (isHanCharacter(mychar)) wordKanji.add(mychar);
        }
        if (wordKanji.size > 0) {
            // console.log("Emplacing relationship:", pref, wordKanji);
            this.emplaceRel(entry.ent_seq, wordKanji)
        }
    }

    private emplaceRel(seq: number, kanji: Iterable<string>) {
        const res = this.m_seqToKanji.get(seq);
        if (!res) {
            this.m_seqToKanji.set(seq, new Set(kanji));
        }

        for (const c of kanji) {
            res?.add(c);

            const resk = this.m_kanjiToSec.get(c);
            if (!resk) {
                this.m_kanjiToSec.set(c, [seq]);
                continue;
            }
            resk.push(seq);
        }
        // console.log(this.m_seqToKanji.get(seq));
    }

    public getSeqs(char: string): number[] {
        return this.m_kanjiToSec.get(char) || [];
    }

    private m_seqToKanji: Map<number, Set<string>> = new Map();
    private m_kanjiToSec: Map<string, number[]> = new Map();
}


async function buildKanji() {
    const unihan = await Unihan.create(k_UNIHAN_DB_PATH);
    const kanjidic = new Kanjidic(k_KANJIDIC_FILE_PATH);
    const cedict = new Cedict(k_CEDICT_FILE_PATH);

    // Populate transliterations and readings
    const kanji: KanjiMap = buildKanjiMapFromFileList(k_SOURCE_FILE_LIST, { unihan, kanjidic, cedict });


    return;

    // const jmdict: Jmdict = await Jmdict.create('test_xml.xml');
    // // Populate index
    // const charIndex = new CharIndex();
    // jmdict.forEachEntry((entry: JmdictEntry) => {
    //     charIndex.annotateDictEntry(entry);
    // });

    // const getPreferredWordBySeq = (seq: number): string | undefined => {
    //     const entry = jmdict.getEntryBySeq(seq);
    //     return entry ? getPreferredReading(entry)[0] : undefined;
    // }

    // kanji.forEachCard((c: KanjiCard) => {
    //     if (fuzzy_empty(c.japaneseChar)) return;
    //     const seqs = charIndex.getSeqs(c.japaneseChar.v[0]);
    //     const words = seqs.map(seq => getPreferredWordBySeq(seq))
    //     const words_d: string[] = words.filter(w => !!w) as string[];
    //     c.japaneseOnVocab.v = words_d;
    //     if (words_d.length > 0)
    //         console.log(c.japaneseChar, words);
    // });
    // charIndex.getSeqs()


}

buildKanji();