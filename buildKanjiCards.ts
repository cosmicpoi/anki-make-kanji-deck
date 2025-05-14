import * as fs from 'fs'
import { Unihan } from './unihan';
import { Kanjidic } from './kanjidic';
import { Cedict } from './cedict';
import { TieredWordList } from './TieredWordList';
import { getAllChars, VariantMap } from './VariantMap';
import { defaultKanjiCard, KanjiCard } from './KanjiCard';
import { Bccwj } from './bccwj';
import { Bclu } from './Bclu';
import * as OpenCC from 'opencc-js';
import { isHanCharacter } from './types';

type FreqCharSorter = {
    getCnFreqIdx: (a: string) => number;
    getJpFreqIdx: (a: string) => number;
    cnSorter: (a: string, b: string) => number;
    jpSorter: (a: string, b: string) => number;
};

export function getSorter(modules: { unihan: Unihan, bccwj: Bccwj, bclu: Bclu }): FreqCharSorter {
    const { bclu, bccwj, unihan } = modules;

    const cnMaxFreq = bclu.getMaxFrequency();
    const jpMaxFreq = bccwj.getMaxFrequency();

    let cnFreqNorm = 2000000000 / cnMaxFreq;
    let jpFreqNorm = 2000000000 / jpMaxFreq;

    const getFreqIdx = (getFreq: (c: string) => number, candidate: string): number => {
        const strokeCountInv = (100 - unihan.getTotalStrokes(candidate));
        return getFreq(candidate) + strokeCountInv / 100;
    }
    // const getCnFreqIdx = (a: string) => {
    //     console.log(_getCnFreqIdx(a));
    //     return _getCnFreqIdx(a);
    // }

    const getCnFreqIdx = (a: string): number => getFreqIdx(bclu.getFrequency, a) * cnFreqNorm;
    const getJpFreqIdx = (a: string): number => getFreqIdx(bccwj.getFrequency, a) * jpFreqNorm;

    const jpSorter = (a: string, b: string) =>
        getJpFreqIdx(b) - getJpFreqIdx(a);
    const cnSorter = (a: string, b: string) =>
        getCnFreqIdx(b) - getCnFreqIdx(a);

    return { getCnFreqIdx, getJpFreqIdx, jpSorter, cnSorter };
}

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
    const converter_s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });

    // Emplace chars into Kanji Map
    const variantMap = new VariantMap(unihan, japaneseList, simpChineseList, true);

    const { jpSorter, cnSorter } = getSorter({ unihan, bccwj, bclu });

    const firstOrEmpty = (a: string[]): string[] => a.length == 0 ? [] : [a[0]];

    // Build deck using variant map as base
    let cards: KanjiCard[] = [];
    variantMap.forEachEntry(e => {
        const card: KanjiCard = {
            ...defaultKanjiCard(),
            // characters
            japaneseChar: e.japaneseChar,
            simpChineseChar: e.simpChineseChar,
            tradChineseChar: e.tradChineseChar,

            // readings
            pinyin: e.pinyin,
            onyomi: e.onyomi,
            kunyomi: e.kunyomi,
        };
        cards.push(card);
    });

    // Clean up readings
    cards.forEach(e => {
        // Filter out stuff that's unreadable
        e.japaneseChar = e.japaneseChar.filter(e => isHanCharacter(e));
        e.simpChineseChar = e.simpChineseChar.filter(e => isHanCharacter(e));

        // Sort by frequency
        e.japaneseChar.sort(jpSorter);
        e.simpChineseChar.sort(cnSorter);

        // Pick the best entry
        e.japaneseChar = firstOrEmpty(e.japaneseChar),
        e.simpChineseChar = firstOrEmpty(e.simpChineseChar),

        e.tradChineseChar = [...new Set(e.simpChineseChar.map(c => converter_s2t(c)))];
    });
    cards = cards.filter(e => !(e.japaneseChar.length == 0 && e.simpChineseChar.length == 0 && e.tradChineseChar.length == 0));

    // Populate readings
    cards.forEach(e => {
        variantMap.populateReadings(e);

        const unihanDefsJp: string[] = unihan.getEnglishDefinition(e.japaneseChar[0]);
        const unihanDefsCn: string[] = unihan.getEnglishDefinition(e.simpChineseChar[0]);
        const kanjidicDefs: string[] = kanjidic.getMeaning(e.japaneseChar[0]);
        const cedictDefs: string[] = cedict.getDefinitions(e.simpChineseChar[0]);

        let englishMeaning = unihanDefsJp;
        // prefer unihan => kanjidict => cedict in this order
        if (englishMeaning.length == 0) {
            englishMeaning = unihanDefsCn;
        }
        if (englishMeaning.length == 0) {
            englishMeaning = kanjidicDefs;
        }
        if (englishMeaning.length == 0) {
            englishMeaning = cedictDefs;
        }

        e.englishMeaning = englishMeaning;
    })

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

