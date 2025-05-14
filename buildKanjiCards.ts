import { Unihan } from './unihan';
import { Kanjidic } from './kanjidic';
import { Cedict } from './cedict';
import { getAllChars, VariantMap } from './VariantMap';
import { defaultKanjiCard, KanjiCard } from './KanjiCard';
import { Bccwj } from './bccwj';
import { Bclu } from './Bclu';
import * as OpenCC from 'opencc-js';
import { apply_getter_to_arr, combine_without_duplicates, isHanCharacter } from './types';
import { getJpSorter, getSorter } from './freqCharSort';
import { Jmdict, getPreferredReading, getPreferredRele } from './jmdict';
import * as wanakana from 'wanakana';
import { minSubstrLevenshtein } from './levenshtein';
import { JSDocParsingMode } from 'typescript';
import { Hanzidb } from './Hanzidb';

function getJapaneseVocab(
    mychar: string,
    charReadings: string[],
    modules: { jmdict: Jmdict, unihan: Unihan, bccwj: Bccwj },
): {
    vocab: Record<string, string[]>,
    furigana: Record<string, string>
} {
    const { jmdict, unihan, bccwj } = modules;
    const { jpSorter } = getJpSorter({ unihan, bccwj });

    const entries = jmdict.getPreferredEntriesByChar(mychar);
    entries.sort((e1, e2) => jpSorter(getPreferredReading(e1), getPreferredReading(e2)));

    // char reading to Kele
    const vocabMap: Record<string, string[]> = {};
    // kele to rele
    const furiganaMap: Record<string, string> = {};

    charReadings.forEach(r => { vocabMap[r] = []; })

    for (const entry of entries) {
        const entryReading = getPreferredReading(entry);
        const entryHiragana = getPreferredRele(entry);
        const entryRoma = wanakana.toRomaji(entryHiragana);
        const readingScores: Record<string, number> = {};
        charReadings.forEach(r => { readingScores[r] = Infinity; });
        charReadings.forEach((charReading) => {
            const charRoma = wanakana.toRomaji(charReading);
            const dist = minSubstrLevenshtein(charRoma, entryRoma);
            readingScores[charReading] = dist;
        });

        let minScore = Infinity;
        let bestCharReading = charReadings[0];
        charReadings.forEach((charReading) => {
            if (readingScores[charReading] < minScore) {
                minScore = readingScores[charReading];
                bestCharReading = charReading;
            }
        });

        if (!vocabMap[bestCharReading].includes(entryReading))
            vocabMap[bestCharReading].push(entryReading);
        if (furiganaMap[entryReading] == undefined) {
            furiganaMap[entryReading] = entryHiragana;
        }
    }

    // onVocab = onVocab.filter((_, i) => i < maxReadings);
    // kunVocab = kunVocab.filter((_, i) => i < maxReadings);
    return { vocab: vocabMap, furigana: furiganaMap };
}

export function buildKanjiCardsFromLists(
    props: {
        japaneseList: string[],
        simpChineseList: string[],
        modules: {
            unihan: Unihan,
            jmdict: Jmdict,
            kanjidic: Kanjidic,
            cedict: Cedict,
            bccwj: Bccwj,
            bclu: Bclu,
            hanzidb: Hanzidb,
        }
    }
): KanjiCard[] {
    // Initialize resources
    const { unihan, kanjidic, cedict, bccwj, bclu, jmdict, hanzidb } = props.modules;
    const { japaneseList, simpChineseList } = props;
    const converter_s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });

    // Emplace chars into Kanji Map
    const variantMap = new VariantMap(japaneseList, simpChineseList, props.modules, true);

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

    // Guess empty characters
    cards.forEach(e => {
        // Fill in empty chinese variants only
        if (e.simpChineseChar.length == 0 && e.japaneseChar.length != 0) {
            const jpChar = e.japaneseChar[0];
            const cid = unihan.getClusterId(jpChar);
            const clusterChars = unihan.getClusterById(cid);

            e.simpChineseChar = clusterChars.filter(c => hanzidb.getEntry(c) != undefined);
            e.tradChineseChar = [...new Set(e.simpChineseChar.map(c => converter_s2t(c)))];
        }
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
        e.japaneseChar = firstOrEmpty(e.japaneseChar);
        e.simpChineseChar = firstOrEmpty(e.simpChineseChar);

        e.tradChineseChar = [...new Set(e.simpChineseChar.map(c => converter_s2t(c)))];
    });
    cards = cards.filter(e => !(e.japaneseChar.length == 0 && e.simpChineseChar.length == 0 && e.tradChineseChar.length == 0));

    // Populate readings
    cards.forEach(e => {
        e.pinyin = apply_getter_to_arr(unihan.getMandarinPinyin, e.simpChineseChar);
        if (e.pinyin.length == 0) {
            e.pinyin = apply_getter_to_arr(unihan.getMandarinPinyin, e.japaneseChar);
        }
        e.onyomi = apply_getter_to_arr(unihan.getJapaneseOn, e.japaneseChar);
        e.kunyomi = apply_getter_to_arr(unihan.getJapaneseKun, e.japaneseChar);
        if (e.onyomi.length == 0 && e.kunyomi.length == 0) {
            e.onyomi = apply_getter_to_arr(unihan.getJapaneseOn, e.simpChineseChar);
            e.kunyomi = apply_getter_to_arr(unihan.getJapaneseKun, e.simpChineseChar);
        }

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

    type VocabCard = {
        lemma: string;
        hiragana: string;
    }

    // Populate japanese vocab
    // const WORDS_PER_CARD = 4;
    // const WORDS_PER_READING = 2;
    // cards.forEach(e => {
    //     if (e.japaneseChar.length == 0) return;
    //     const charReadings: string[] = [...e.onyomi, ...e.kunyomi];
    //     let { vocab, furigana } = getJapaneseVocab(e.japaneseChar[0], charReadings, { jmdict, unihan, bccwj });

    //     let onVocabSet: Set<string> = new Set();
    //     let kunVocabSet: Set<string> = new Set();

    //     for (const r of charReadings) {
    //         const vocablist = vocab[r];
    //         let count = 0;
    //         for (const word of vocablist) {
    //             if (count == WORDS_PER_READING) break;
    //             if (wanakana.isHiragana(r.at(0))) {
    //                 kunVocabSet.add(word);
    //             } else {
    //                 onVocabSet.add(word);
    //             }
    //             count++;
    //         }
    //     };

    //     let onVocab: string[] = [...onVocabSet];
    //     let kunVocab: string[] = [...kunVocabSet];

    //     onVocab.sort(jpSorter);
    //     kunVocab.sort(jpSorter);

    //     onVocab = onVocab.filter((_, i) => i < WORDS_PER_CARD);
    //     kunVocab = kunVocab.filter((_, i) => i < WORDS_PER_CARD);

    //     e.japaneseOnVocab = onVocab.map(c => `${c}[${furigana[c]}]`);
    //     e.japaneseKunVocab = kunVocab.map(c => `${c}[${furigana[c]}]`);
    // });


    return cards;
}

