import * as fs from 'fs'
import { Unihan } from './unihan';
import { Kanjidic } from './kanjidic';
import { Cedict } from './cedict';
import { TieredWordList } from './TieredWordList';
import { VariantMap } from './VariantMap';
import { defaultKanjiCard, KanjiCard } from './KanjiCard';
import { Bccwj } from './bccwj';
import { Bclu } from './Bclu';
import * as OpenCC from 'opencc-js';
import { isHanCharacter } from './types';

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

    const getFreqIdx = (getFreq: (c: string) => number, candidate: string): number => {
        const strokeCountInv = (100 - unihan.getTotalStrokes(candidate));
        return getFreq(candidate) + strokeCountInv / 100;
    }
    const jpSorter = (a: string, b: string) =>
        getFreqIdx(bccwj.getFrequency, b) - getFreqIdx(bccwj.getFrequency, a);
    const cnSorter = (a: string, b: string) =>
        getFreqIdx(bclu.getFrequency, b) - getFreqIdx(bclu.getFrequency, a);

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

    // Filter stuff out that's unreadable
    cards.forEach(e => {
        e.japaneseChar = e.japaneseChar.filter(e => isHanCharacter(e));
        e.simpChineseChar = e.simpChineseChar.filter(e => isHanCharacter(e));
        e.tradChineseChar = e.tradChineseChar.filter(e => isHanCharacter(e));

        e.japaneseChar.sort(jpSorter);
        e.simpChineseChar.sort(cnSorter);
        e.tradChineseChar.sort(cnSorter);

        // Choose preferred reading
        // e.japaneseChar = firstOrEmpty(e.japaneseChar);
        // e.simpChineseChar = firstOrEmpty(e.simpChineseChar);
        // e.tradChineseChar = firstOrEmpty(e.tradChineseChar).map(e => converter_s2t(e));
    });

    cards = cards.filter(e => !(e.japaneseChar.length == 0 && e.simpChineseChar.length == 0 && e.tradChineseChar.length == 0));

    

    // Populate readings
    cards.forEach(e => {
        variantMap.populateReadings(e);
        
        const unihanDefs: string[] = unihan.getEnglishDefinition(e.japaneseChar[0]);
        const kanjidicDefs: string[] = kanjidic.getMeaning(e.japaneseChar[0]);
        const cedictDefs: string[] = cedict.getDefinitions(e.simpChineseChar[0]);

        let englishMeaning = unihanDefs;
        // prefer unihan => kanjidict => cedict in this order
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

