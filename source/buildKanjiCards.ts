import { Unihan } from 'Unihan';
import { Kanjidic } from 'Kanjidic';
import { Cedict, CedictEntry } from 'consts/Cedict';
import { VariantMap } from 'VariantMap';
import { defaultKanjiCard, KanjiCard } from 'KanjiCard';
import { Bccwj } from 'modules/Bccwj';
import * as OpenCC from 'opencc-js';
import { apply_getter_to_arr, isHanCharacter, isHanCharacters } from './types';
import { getSorter } from 'utils/freqCharSort';
import { Jmdict, getPreferredReading, getPreferredRele } from './modules/Jmdict';
import * as wanakana from 'wanakana';
import { minSubstrLevenshtein } from './utils/levenshtein';
import { Hanzidb } from 'Hanzidb';
import { Subtlex } from 'Subtlex';

function getJapaneseVocab(
    mychar: string,
    charReadings: string[],
    modules: { jmdict: Jmdict },
): {
    vocab: Record<string, string[]>, // maps reading(on or kun) to lemmas
    furigana: Record<string, string> // maps lemmas to hiragana readings
} {
    const { jmdict } = modules;

    const entries = jmdict.getPreferredEntriesByChar(mychar);

    // char reading to Kele
    const vocabMap: Record<string, string[]> = {};
    // kele to rele
    const furiganaMap: Record<string, string> = {};

    charReadings.forEach(r => { vocabMap[r] = []; })

    for (const entry of entries) {
        const entryReading = getPreferredReading(entry);
        if (entryReading == mychar) continue;
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
            subtlex: Subtlex,
            hanzidb: Hanzidb,
        }
    }
): KanjiCard[] {
    // Initialize resources
    const { unihan, kanjidic, cedict, bccwj, subtlex, jmdict, hanzidb } = props.modules;
    const { japaneseList, simpChineseList } = props;
    const converter_s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });

    // Emplace chars into Kanji Map
    const variantMap = new VariantMap(japaneseList, simpChineseList, props.modules, true);

    const { jpSorter, cnSorter } = getSorter({ unihan, jpFreq: bccwj, cnFreq: subtlex });

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

    // Clean up chars
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
        e.onyomi = apply_getter_to_arr(unihan.getJapaneseOn, e.japaneseChar);
        e.kunyomi = apply_getter_to_arr(unihan.getJapaneseKun, e.japaneseChar);

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


    // Populate vocab 
    for (const e of cards) {
        // use these to pick sino-chinese later one 
        let jpAllVocab: [string, string][] = []; // tuples of kanji reading, word
        const jpCharReadings: string[] = [...e.onyomi, ...e.kunyomi];

        // Populate Japanese vocab
        let furigana: Record<string, string> = {};
        let onKunToVocabMap: Record<string, string[]> = {};

        if (e.japaneseChar.length != 0) {

            let { vocab: v, furigana: f } = getJapaneseVocab(e.japaneseChar[0], jpCharReadings, props.modules);
            furigana = f;
            onKunToVocabMap = v;
            let vocabSet: Set<string> = new Set();

            const wordToOnKunReading: Record<string, string> = {};

            for (const r of jpCharReadings) {
                const vocablist = onKunToVocabMap[r];
                for (const word of vocablist) {
                    vocabSet.add(word);
                    wordToOnKunReading[word] = r;
                }
            };

            jpAllVocab = [...vocabSet].map(w => [wordToOnKunReading[w], w]);
        }

        // Populate chinese vocab
        let cnEntries: CedictEntry[] = [];
        if (e.simpChineseChar.length != 0) {
            cnEntries = cedict.getVocabEntriesForChar(e.simpChineseChar[0]);
            cnEntries = cnEntries.filter(e => e.simplified.length != 1);
        }

        // Choose vocab - Look for sino-japanese vocab, trim extra entries

        // Identify sino-jp vocab
        const sinojp: [CedictEntry, [string, string]][] = [];
        if (e.japaneseChar.length != 0 && e.simpChineseChar.length != 0) {
            let cnVocab: CedictEntry[] = cnEntries;
            let jpVocab: [string, string][] = jpAllVocab;
            for (let i = 0; i < cnVocab.length; i++) {
                for (let j = 0; j < jpVocab.length; j++) {
                    const cn = cnVocab[i].simplified;
                    const jp = jpVocab[j][1];
                    if (!isHanCharacters(jp)) continue;
                    if (jp.length != cn.length) continue;

                    let isVariant = true;
                    for (let k = 0; k < jp.length; k++) {
                        const jp_c = jp.at(k);
                        const cn_c = cn.at(k);
                        if (!jp_c || !cn_c) {
                            isVariant = false;
                            break;
                        }
                        if (!unihan.hasLink(jp_c, cn_c)) {
                            isVariant = false;
                            break;
                        }
                    }

                    if (isVariant) {
                        sinojp.push([cnVocab[i], jpVocab[j]]);
                    }
                }
            }
        }

        const isSinoJp_jp = (candidate: string): number | undefined => {
            for (let i = 0; i < sinojp.length; i++) {
                const [_cn, jp] = sinojp[i];
                const [_r, word] = jp;
                if (word == candidate) {
                    return i;
                }
            }
            return undefined;
        }

        // Choose words:
        // - For Japanese, pick the top two entries, then the top sino-jp, then the top non-sino jp, per reading
        // - For Chinese, take each sino-jp word picked, then pick two more, then pad up to 4 if needed

        const pick_jp = (word: string, reading: string) => {
            if (wanakana.isHiragana(reading.at(0))) {
                e.japaneseKunVocab.push(word);
            }
            else {
                e.japaneseOnVocab.push(word);
            }
        }

        const sinojp_pick: number[] = [];

        if (e.japaneseChar.length != 0) {
            for (const r of jpCharReadings) {
                const candidates = [...onKunToVocabMap[r]];
                candidates.sort(jpSorter);

                // Pick a sino-jp candidate
                for (let i = 0; i < candidates.length; i++) {
                    const idx = isSinoJp_jp(candidates[i]);
                    if (idx != undefined) {
                        pick_jp(candidates[i], r);
                        sinojp_pick.push(idx);
                        candidates.splice(i, 1);
                        break;
                    }
                }
                // Pick a non-sino jp candidate
                for (let i = 0; i < candidates.length; i++) {
                    if (!isSinoJp_jp(candidates[i]) == undefined) {
                        pick_jp(candidates[i], r);
                        candidates.splice(i, 1);
                        break;
                    }
                }
                // Pick the front candidate
                if (candidates.length != 0) {
                    pick_jp(candidates[0], r);
                    const idx = isSinoJp_jp(candidates[0]);
                    if (idx != undefined) sinojp_pick.push(idx);
                    candidates.splice(0, 1);
                }
            };

            e.japaneseOnVocab.sort(jpSorter);
            e.japaneseKunVocab.sort(jpSorter);

            e.japaneseOnVocab = e.japaneseOnVocab.map(c => `${c}[${furigana[c]}]`);
            e.japaneseKunVocab = e.japaneseKunVocab.map(c => `${c}[${furigana[c]}]`);
        }

        const CN_WORDS_PER_CARD = 4;
        if (e.simpChineseChar.length != 0) {
            const pickedEntries: CedictEntry[] = sinojp_pick.map((idx) => sinojp[idx][0]);
            let candidates = [...cnEntries];
            candidates.sort((e1: CedictEntry, e2: CedictEntry) => cnSorter(e1.simplified, e2.simplified));
            candidates = candidates.filter(e => !pickedEntries.includes(e));
            while (pickedEntries.length < CN_WORDS_PER_CARD && candidates.length > 0) {
                pickedEntries.push(candidates[0]);
                candidates.splice(0, 1);
            }

            e.simpChineseVocab = pickedEntries.map(e => `${e.simplified}[${e.reading[0].pinyin}]`);
            e.tradChineseVocab = pickedEntries.map(e => `${e.traditional}[${e.reading[0].pinyin}]`);
        }
    }

    return cards;
}

