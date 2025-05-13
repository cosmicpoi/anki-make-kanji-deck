import * as fs from 'fs'
import { Unihan } from './unihan';
import { Kanjidic } from './kanjidic';
import { Cedict } from './cedict';
import { TieredWordList } from './TieredWordList';
import { VariantMap } from './VariantMap';
import { defaultKanjiCard, KanjiCard } from './KanjiCard';
import { Bccwj } from './bccwj';
import { Bclu } from './Bclu';

export function buildKanjiCardsFromLists(
    props: {
        fileListDir: string,
        japaneseList: string[],
        simpChineseList: string[],
        modules: {
            unihan: Unihan,
            kanjidic: Kanjidic,
            cedict: Cedict,
            bccwj: Bccwj,
            bclu: Bclu,
        }
    }
): KanjiCard[] {
    // Initialize resources
    const { modules: { unihan, kanjidic, cedict, bccwj, bclu }, japaneseList, simpChineseList } = props;

    // Emplace chars into Kanji Map
    const variantMap = new VariantMap(unihan, japaneseList, simpChineseList, true);

    const getFreqIdx = (getFreq: (c: string) => number, candidate: string): number => {
        const strokeCountInv = (100 - unihan.getTotalStrokes(candidate));
        return getFreq(candidate) + strokeCountInv / 100;
    }

    // Build deck using variant map as base
    const cards: KanjiCard[] = [];
    variantMap.forEachEntry(e => {
        // If there is more than one character, sort by frequency
        const jpSorter = (a: string, b: string) =>
            getFreqIdx(bccwj.getFrequency, b) - getFreqIdx(bccwj.getFrequency, a);
        const cnSorter = (a: string, b: string) =>
            getFreqIdx(bclu.getFrequency, b) - getFreqIdx(bclu.getFrequency, a);

        const japaneseChar = e.japaneseChar;
        const simpChineseChar = e.simpChineseChar;
        const tradChineseChar = e.tradChineseChar;

        japaneseChar.sort(jpSorter);
        simpChineseChar.sort(cnSorter);
        tradChineseChar.sort(cnSorter);

        const unihanDefs: string[] = unihan.getEnglishDefinition(japaneseChar[0]);
        const kanjidicDefs: string[] = kanjidic.getMeaning(japaneseChar[0]);
        const cedictDefs: string[] = cedict.getDefinitions(simpChineseChar[0]);

        let englishMeaning = unihanDefs;
        // prefer unihan => kanjidict => cedict in this order
        if (englishMeaning.length == 0) {
            englishMeaning = kanjidicDefs;
        }
        if (englishMeaning.length == 0) {
            englishMeaning = cedictDefs;
        }

        const card: KanjiCard = {
            ...defaultKanjiCard(),
            // characters
            japaneseChar,
            simpChineseChar,
            tradChineseChar,

            // readings
            pinyin: e.pinyin,
            onyomi: e.onyomi,
            kunyomi: e.kunyomi,

            // meaning
            englishMeaning,
        };
        cards.push(card);
    });

    const getSortKey = (c: KanjiCard) => {
        const entries = [...c.japaneseChar, ...c.simpChineseChar, ...c.tradChineseChar];
        entries.sort();
        return entries.join(',');
    }
    cards.sort((c1, c2) =>
        getSortKey(c1).localeCompare(getSortKey(c2))
    );

    return cards;
}

