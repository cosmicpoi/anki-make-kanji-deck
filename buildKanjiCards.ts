import * as fs from 'fs'
import { Unihan } from './unihan';
import { Kanjidic } from './kanjidic';
import { Cedict } from './cedict';
import { TieredWordList } from './TieredWordList';
import { VariantMap } from './VariantMap';
import { defaultKanjiCard, KanjiCard } from './KanjiCard';
import { Bccwj } from './bccwj';
import { Bclu } from './Bclu';

export function buildKanjiCardsFromFileLists(
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
    const { unihan, kanjidic, cedict, bccwj, bclu } = props.modules;

    // Initialize tiers
    const japaneseTiers = new TieredWordList(props.fileListDir, props.japaneseList);
    const chineseTiers = new TieredWordList(props.fileListDir, props.simpChineseList);

    // Emplace chars into Kanji Map
    const variantMap = new VariantMap(unihan, japaneseTiers.getAllChars(), chineseTiers.getAllChars(), true);

    const getBestCandidate = (getFreq: (c: string) => number, candidates: string[]): [string, number] => {
        let maxFreq = -1;
        let bestCandidate = candidates[0];
        for (const c of candidates) {
            const strokeCountInv = (100 - unihan.getTotalStrokes(c));
            // const freq = bccwj.getFrequency(c) + strokeCountInv / 100;
            const freq = getFreq(c) + strokeCountInv / 100;
            if (freq > maxFreq) {
                maxFreq = freq;
                bestCandidate = c;
            }

        }
        return [bestCandidate, maxFreq]
    }

    // Build deck using variant map as base
    const cards: KanjiCard[] = [];
    variantMap.forEachEntry(e => {
        // If there is more than one character, use frequency list to pick a preferred one 
        const bestOrEmpty = (getFreq: (c: string) => number, mychar: string[]): string[] => {
            if (mychar.length == 0) return [];
            const [char, _freq] = getBestCandidate(bccwj.getFrequency, mychar);
            return [char];
        }
        const japaneseChar = bestOrEmpty(bccwj.getFrequency, e.japaneseChar);
        const simpChineseChar = bestOrEmpty(bclu.getFrequency, e.simpChineseChar);
        const tradChineseChar = bestOrEmpty(bclu.getFrequency, e.tradChineseChar);

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

    return cards;
}

