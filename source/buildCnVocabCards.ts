import * as fs from 'fs'
import { Jmdict, JmdictGlossLang, JmdictSense, getPreferredReading, isUsuallyKana, getPreferredRele, getPreferredSense, isArchaic, isObselete, isVulgar, isSlang, getPreferredKele, getReadings } from 'Jmdict';
import { Cedict } from 'modules/Cedict';
import { Unihan } from 'Unihan';
import { Bccwj } from 'Bccwj';
import { isHanCharacter, isHanCharacters } from 'types';
import { getCnSorter, getJpSorter, getSorter } from 'utils/freqCharSort';
import { Subtlex } from 'Subtlex';
import * as OpenCC from 'opencc-js';
import { VariantMap } from 'VariantMap';
import { getVariantCandidates } from 'utils/variants';
import { k_note_VOCAB_CHINESE } from 'consts/consts';
import * as wanakana from 'wanakana';
import { generateAccentPinyinDelim } from 'utils/pinyin';

export type ChineseVocabCard = {
    simplified: string;
    traditional: string;
    pinyin: string[];
    japanese: string;
    meaning: string;
    sentences: [];
    frequency?: number;
    tags: string[];
}



export async function buildCnVocabCards(props: {
    words: string[],
    variantMap?: VariantMap,
    modules: {
        unihan: Unihan,
        jmdict: Jmdict,
        cedict: Cedict,
        bccwj: Bccwj,
        subtlex: Subtlex,
    }
}): Promise<ChineseVocabCard[]> {
    const { variantMap, words } = props;
    const { unihan, jmdict, cedict, bccwj, subtlex } = props.modules;
    const converter_s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });
    const { jpSorter } = getJpSorter({ unihan, freq: bccwj })


    function getJpVariantsByChar(char: string): string[] {
        const cid = unihan.getClusterId(char);
        if (!cid) return [];
        let vars = unihan.getClusterById(cid).filter(unihan.isJapanese).filter(isHanCharacter);
        if (variantMap) vars = [...vars, ...(variantMap.getEntryByChar(char)?.japaneseChar || [])]
        return vars;
    }

    function getSinoJpCandidates(str: string): string[] {
        const candidates = getVariantCandidates(str, getJpVariantsByChar);
        return candidates.filter(c => !!cedict.getEntry(c));
    }


    const renderedWords: Set<string> = new Set();
    function makeCard(word: string): ChineseVocabCard | undefined {
        const entry = cedict.getEntry(word);
        if (!entry) return undefined;
        if (renderedWords.has(word)) return undefined;
        renderedWords.add(word);

        const traditional = converter_s2t(word);

        // Check if sino-chinese
        let japanese = '';
        const jpCandidates = getSinoJpCandidates(word);
        jpCandidates.sort(jpSorter);
        if (jpCandidates.length > 0) {
            const jpCandidate = jpCandidates[0];
            const jpEntries = jmdict.getEntriesByWord(jpCandidate);
            if (jpEntries.length != 0) {
                const reading = getPreferredRele(jpEntries[0]);
                if (!wanakana.isKatakana(reading)) {
                    japanese = `${jpCandidate}[${reading}]`;
                }
            }
        }

        // Get frequency if it exists
        let frequency: number | undefined = subtlex.getFrequency(word);
        if (frequency == 0) frequency = undefined;


        // Return constructed card
        return {
            simplified: word,
            traditional: traditional != word ? traditional : '',
            pinyin: [generateAccentPinyinDelim(entry.reading[0].pinyin, ' ')],
            japanese,
            meaning: entry.reading[0].definition,
            frequency,
            sentences: [],
            tags: [],
        };
    }

    const cards_raw: [string, ChineseVocabCard | undefined][] = words.map(word => [word, makeCard(word)]);
    console.log("These cards were undefined: ", cards_raw.filter(t => !t[1]).map(t => t[0]))
    const cards: ChineseVocabCard[] = cards_raw.map(t => t[1]).filter(t => !!t);
    return cards;
}

export async function writeCnVocabCardsToFile(props: {
    filePath: string,
    cards: ChineseVocabCard[],
    tagGetter?: (card: ChineseVocabCard) => string[],
    modules: {
        unihan: Unihan;
        bccwj: Bccwj;
        subtlex: Subtlex;
    }
}): Promise<void> {
    const { cards, filePath, tagGetter } = props;
    const { unihan, subtlex } = props.modules;
    const { cnSorter } = getCnSorter({ unihan, freq: subtlex });

    // Sort in place
    cards.sort((c1, c2) => c1.pinyin[0].localeCompare(c2.pinyin[0]));

    // Write tags
    if (tagGetter) {
        cards.forEach(c => {
            c.tags = [...c.tags, ...tagGetter(c)];
        })
    }

    // Write to file
    const writeStream = fs.createWriteStream(filePath, {
        flags: 'w', // 'a' to append
        encoding: 'utf8'
    });

    const field_order: (keyof ChineseVocabCard)[] = [
        'simplified',
        'traditional',
        'pinyin',
        'japanese',
        'meaning',
        'sentences',
        'frequency',
    ];

    const col_count = field_order.length + 2;
    writeStream.write("#separator:tab\n");
    writeStream.write("#html:true\n");
    writeStream.write("#notetype column:1\n");
    writeStream.write(`#tags column:${col_count}\n`);

    cards.forEach(card => {
        let fields: string[] = Array(col_count).fill('');

        const formatFns: { [K in keyof ChineseVocabCard]: (value: ChineseVocabCard[K]) => string; } = {
            simplified: (c: string) => c,
            traditional: (c: string) => c,
            pinyin: (c: string[]) => c.join(','),
            japanese: (c: string) => c,
            meaning: (c: string) => c,
            sentences: (c: string[]) => c.join('<br>'),
            frequency: (n?: number) => n != undefined ? n.toString() : '',
            tags: (c: string[]) => c.join(' '),
        };
        function formatCardField<K extends keyof ChineseVocabCard>(key: K, card: ChineseVocabCard): string {
            return formatFns[key]?.(card[key]) || '';
        }

        for (let i = 0; i < col_count; i++) {
            if (i == 0) {
                fields[i] = k_note_VOCAB_CHINESE;
            }
            else if (i <= field_order.length) {
                const key: keyof ChineseVocabCard = field_order[i - 1];
                fields[i] = formatCardField(key, card) || '';
            }
            else if (i == col_count - 1) {
                fields[i] = formatFns['tags'](card.tags);
            }
        }

        writeStream.write(fields.join('\t') + '\n');
    })
}