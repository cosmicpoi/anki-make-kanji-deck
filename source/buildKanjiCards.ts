import { Unihan } from 'Unihan';
import { Kanjidic } from 'Kanjidic';
import { Cedict, CedictEntry } from 'modules/Cedict';
import { VariantMap } from 'VariantMap';
import { defaultKanjiCard, KanjiCard } from 'KanjiCard';
import { Bccwj } from 'modules/Bccwj';
import * as OpenCC from 'opencc-js';
import { apply_getter_to_arr, combine_without_duplicates, isHanCharacter, isHanCharacters } from './types';
import { getSorter } from 'utils/freqCharSort';
import { Jmdict, JmdictGlossLang, getPreferredReading, getPreferredRele } from './modules/Jmdict';
import * as wanakana from 'wanakana';
import { minSubstrLevenshtein } from './utils/levenshtein';
import { Hanzidb } from 'Hanzidb';
import { Subtlex } from 'Subtlex';
import { generateAccentPinyinDelim } from 'utils/pinyin';
import { generateFurigana } from 'utils/furigana';

function isSinoJpVocab(
    unihan: Unihan,
    jp: string,
    cn: string,
): boolean {
    if (!isHanCharacters(jp)) return false;
    if (jp.length != cn.length) return false;

    for (let k = 0; k < jp.length; k++) {
        const jp_c = jp.at(k);
        const cn_c = cn.at(k);
        if (!jp_c || !cn_c) {
            return false;
        }
        if (!(unihan.hasLink(jp_c, cn_c) || jp_c == cn_c)) {
            return false;
        }
    }
    return true;
}


function getJapaneseVocab(
    mychar: string,
    charReadings: string[],
    jpSorter: (s1: string, s2: string) => number,
    modules: { jmdict: Jmdict },
): {
    vocab: Record<string, string[]>, // maps reading(on or kun) to lemmas
    furigana: Record<string, string>, // maps lemmas to hiragana readings
    meanings: Record<string, string>  // maps lemmas onto meaning strings
} {
    const { jmdict } = modules;

    // char reading to Kele
    const vocabMap: Record<string, string[]> = {};
    charReadings.forEach(r => { vocabMap[r] = []; })
    // kele to rele
    const furiganaMap: Record<string, string> = {};
    // english meanings
    const meaningMap: Record<string, string> = {};

    // In case there's ever a situation where multiple words have the same furigana or meaning,
    // we need to make sure that the most common one is emplaced first, so we sort the entries
    const entries = jmdict.getPreferredEntriesByChar(mychar);
    entries.sort((e1, e2) => jpSorter(e1.cachedPreferredReading, e2.cachedPreferredReading));

    for (const entry of entries) {
        const entryReading = getPreferredReading(entry);
        if (entryReading == mychar) continue; // Don't include the word which is just this char

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
            if (readingScores[charReading] < minScore ||
                readingScores[charReading] == minScore && charReadings[0].length > bestCharReading.length
            ) {
                minScore = readingScores[charReading];
                bestCharReading = charReading;
            }
        });

        if (!vocabMap[bestCharReading].includes(entryReading))
            vocabMap[bestCharReading].push(entryReading);
        if (furiganaMap[entryReading] == undefined) {
            furiganaMap[entryReading] = entryHiragana;
        }
        if (meaningMap[entryReading] == undefined) {
            const textStr = entry.sense[0].gloss
                .filter(g => g.lang == JmdictGlossLang.eng)
                .map(g => g.text).join('; ');
            meaningMap[entryReading] = textStr;
        }
    }

    return { vocab: vocabMap, furigana: furiganaMap, meanings: meaningMap };
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
): {
    cards: KanjiCard[],
    chineseVocab: string[],
    japaneseVocab: string[],
    sinoJapaneseVocab: [string, string][],
} {
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

    // Clean up chars
    cards.forEach(e => {
        // Filter out stuff that's unreadable
        e.japaneseChar = e.japaneseChar.filter(e => isHanCharacter(e));
        e.simpChineseChar = e.simpChineseChar.filter(e => isHanCharacter(e));

        e.tradChineseChar = [...new Set(e.simpChineseChar.map(c => converter_s2t(c)))];
    });
    cards = cards.filter(e => !(e.japaneseChar.length == 0 && e.simpChineseChar.length == 0 && e.tradChineseChar.length == 0));

    // Guess empty characters
    let cnGuessCount = 0;
    let jpGuessCount = 0;
    cards.forEach(e => {
        // Fill in empty chinese variants only
        if (e.simpChineseChar.length == 0 && e.japaneseChar.length != 0) {
            const cids = e.japaneseChar.map(c => unihan.getClusterId(c));
            let clusterChars = cids.map(cid => unihan.getClusterById(cid)).flat();
            clusterChars = [...new Set(clusterChars)];

            e.simpChineseChar = clusterChars.filter(c => hanzidb.getEntry(c) != undefined);
            e.tradChineseChar = [...new Set(e.simpChineseChar.map(c => converter_s2t(c)))];
            if (e.simpChineseChar.length != 0) cnGuessCount++;
        }
        // Fill in empty Japanese variants
        if (e.japaneseChar.length == 0 && e.simpChineseChar.length != 0) {
            const chars: string[] = [...new Set([...e.simpChineseChar, ...e.tradChineseChar])];
            const cids = chars.map(c => unihan.getClusterId(c));
            let clusterChars = cids.map(cid => unihan.getClusterById(cid)).flat();
            clusterChars = [...new Set(clusterChars)];

            e.japaneseChar = clusterChars.filter(c => kanjidic.getEntry(c) != undefined);
            if (e.japaneseChar.length != 0) jpGuessCount++;
        }
    });
    console.log(`Guessed ${cnGuessCount} Chinese and ${jpGuessCount} Japanese characters`);

    // Pick a single entry
    cards.forEach(e => {
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

    // Populate stroke count and frequency
    cards.forEach(e => {
        if (e.simpChineseChar.length > 0) {
            const char = e.simpChineseChar[0];
            e.chineseStrokeCount = unihan.getTotalStrokes(char);
            e.chineseFrequency = subtlex.getFrequency(char);
        }

        if (e.japaneseChar.length > 0) {
            const char = e.japaneseChar[0];
            e.japaneseStrokeCount = unihan.getTotalStrokes(char);
            e.japaneseFrequency = bccwj.getFrequency(char);
        }
    });


    const chineseVocab: string[] = [];
    const japaneseVocab: string[] = [];
    const sinoJapaneseVocab: [string, string][] = [];
    // Populate vocab 
    for (const e of cards) {
        // // @ts-ignore
        // if (0 == 0) break;
        // use these to pick sino-chinese later one 
        let jpAllVocab: [string, string][] = []; // tuples of kanji reading, word
        const jpCharReadings: string[] = [...e.onyomi, ...e.kunyomi];

        // Populate Japanese vocab
        let jpFurigana: Record<string, string> = {};
        let jpReadingVocabMap: Record<string, string[]> = {};
        let jpMeanings: Record<string, string> = {};

        if (e.japaneseChar.length != 0) {
            let { vocab: v, furigana: f, meanings: m } = getJapaneseVocab(e.japaneseChar[0], jpCharReadings, jpSorter, props.modules);
            jpFurigana = f;
            jpReadingVocabMap = v;
            jpMeanings = m;
            let vocabSet: Set<string> = new Set();

            for (const r of jpCharReadings) {
                for (const word of jpReadingVocabMap[r]) {
                    if (!vocabSet.has(word)) {
                        vocabSet.add(word);
                        jpAllVocab.push([r, word]);
                    }
                }
            }
        }

        // Populate chinese vocab
        let cnEntries: CedictEntry[] = [];
        if (e.simpChineseChar.length != 0) {
            cnEntries = cedict.getVocabEntriesForChar(e.simpChineseChar[0]);
            cnEntries = cnEntries.filter(e => e.simplified.length != 1);
        }

        // Choose vocab - Look for sino-japanese vocab, trim extra entries

        // Identify sino-jp vocab
        const sinojp: [CedictEntry, [string, string]][] = []; // cn entry, [kanji reading, jp word]
        if (e.japaneseChar.length != 0 && e.simpChineseChar.length != 0) {
            let cnVocab: CedictEntry[] = cnEntries;
            for (let i = 0; i < cnVocab.length; i++) {
                for (let j = 0; j < jpAllVocab.length; j++) {
                    if (isSinoJpVocab(unihan, cnVocab[i].simplified, jpAllVocab[j][1])) {
                        sinojp.push([cnVocab[i], jpAllVocab[j]]);
                    }
                }
            }
        }

        // Check if a given jp lemma is sinojp; if it is, return its index in the sinojp list
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
        const isSinoJp_cn = (candidate: CedictEntry): number | undefined => {
            for (let i = 0; i < sinojp.length; i++) {
                const [cn, _jp] = sinojp[i];
                if (cn == candidate) {
                    return i;
                }
            }
            return undefined;
        }

        // Choose words
        // - For Japanese, pick the top two entries, then the top sino-jp, then the top non-sino jp, per reading
        // - For Chinese, take each sino-jp word picked, then pick two more, then pad up to 4 if needed

        // Array that tracks which sino-jp vocab we've picked so far (indices in sinojp map)
        const sinojp_pick: number[] = [];

        if (e.japaneseChar.length != 0) {
            // For each reading, store the list of picked readings (and whether each one is sino-jp)
            const pickedPerReading: Record<string, string[]> = {};

            for (const r of jpCharReadings) {
                const candidates = [...jpReadingVocabMap[r]];
                candidates.sort(jpSorter);


                const picked: string[] = [];
                // Pick a sino-jp candidate
                for (let i = 0; i < candidates.length; i++) {
                    if (isSinoJp_jp(candidates[i]) != undefined) {
                        picked.push(candidates[i]);
                        candidates.splice(i, 1);
                        break;
                    }
                }
                // Pick a non-sino jp candidate
                for (let i = 0; i < candidates.length; i++) {
                    if (isSinoJp_jp(candidates[i]) == undefined) {
                        picked.push(candidates[i]);
                        candidates.splice(i, 1);
                        break;
                    }
                }
                // Pick the front candidate
                if (candidates.length != 0) {
                    picked.push(candidates[0]);
                    candidates.splice(0, 1);
                }
                pickedPerReading[r] = picked;
                pickedPerReading[r].sort(jpSorter);
            }

            for (const r of jpCharReadings) {
                for (const word of pickedPerReading[r]) {
                    const idx = isSinoJp_jp(word);
                    if (idx != undefined) sinojp_pick.push(idx);
                    if (wanakana.isHiragana(r))
                        e.japaneseKunVocab.push(word);
                    else e.japaneseOnVocab.push(word);
                }
            }
            e.japaneseOnVocab.sort(jpSorter);
            e.japaneseKunVocab.sort(jpSorter);

            const getStr = (w: string): string => {
                let sinoJpDesc = '';
                const idx = isSinoJp_jp(w);
                if (idx != undefined) {
                    const cnword = sinojp[idx][0].simplified;
                    const pinyin = sinojp[idx][0].reading[0].pinyin;
                    sinoJpDesc = `/${cnword}[${generateAccentPinyinDelim(pinyin)}]`;
                }

                return `${generateFurigana(w, jpFurigana[w], true)}${sinoJpDesc} - ${jpMeanings[w]}`;
            }
            e.japaneseOnVocab = e.japaneseOnVocab.map(c => getStr(c));
            e.japaneseKunVocab = e.japaneseKunVocab.map(c => getStr(c));
        }

        const CN_WORDS_PER_CARD = 4;
        if (e.simpChineseChar.length != 0) {
            // First, pick the word we know are jp-sino from before
            const pickedEntries: CedictEntry[] = sinojp_pick.map((idx) => sinojp[idx][0]);
            // Now, pick new candidates based on frequency order
            let candidates = [...cnEntries];
            candidates.sort((e1: CedictEntry, e2: CedictEntry) => cnSorter(e1.simplified, e2.simplified));
            candidates = candidates.filter(e => !pickedEntries.includes(e));
            // Pick up to max # of cards
            while (pickedEntries.length < CN_WORDS_PER_CARD && candidates.length > 0) {
                pickedEntries.push(candidates[0]);
                candidates.splice(0, 1);
            }

            // Format and output
            const getStr = (e: CedictEntry): string => {
                let tradVar = '';
                if (e.traditional != e.simplified) {
                    tradVar = `/${e.traditional}`;
                }

                let sinoJpDesc = '';
                const idx = isSinoJp_cn(e);
                if (idx != undefined) {
                    const jpword = sinojp[idx][1][1];
                    const furiga = jpFurigana[jpword];
                    sinoJpDesc = `/${generateFurigana(jpword, furiga, true)}`;
                }

                return `${e.simplified}[${generateAccentPinyinDelim(e.reading[0].pinyin)}]${tradVar}${sinoJpDesc} - ${e.reading[0].definition}`;
            }
            e.chineseVocab = pickedEntries.map(e => getStr(e));
        }
    }

    return { cards, chineseVocab, japaneseVocab, sinoJapaneseVocab };
}

