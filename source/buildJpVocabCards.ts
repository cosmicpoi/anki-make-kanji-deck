import * as fs from 'fs'
import { Jmdict, JmdictGlossLang, JmdictSense, getPreferredReading, isUsuallyKana, getPreferredRele } from 'Jmdict';
import { Cedict } from 'modules/Cedict';
import { Unihan } from 'Unihan';
import { Bccwj } from 'Bccwj';
import { isHanCharacter, isHanCharacters } from 'types';
import { getCnSorter, getSorter } from 'utils/freqCharSort';
import { Subtlex } from 'Subtlex';
import * as OpenCC from 'opencc-js';
import { generateAccentPinyinDelim } from 'utils/pinyin';
import { VariantMap } from 'VariantMap';
import { k_tag_USUALLY_KANA } from 'consts/consts';

type JapaneseVocabCard = {
    word: string;
    hiragana: string;
    chinese: string;
    meaning: string;
    grammar: string[];
    otherMeanings: string[];
    sentences: string[];
    tags: string[];
    frequency?: number;
}

function interpretParens(str: string) {
    str = str.replace("(futsuumeishi)", "(普通名詞)");
    str = str.replace("(fukushitekimeishi)", "(副詞的名詞)");
    str = str.replace("(keiyoushi)", "(形容詞)");
    str = str.replace("(rentaishi)", "(連体詞)");
    str = str.replace("(fukushi)", "(副詞)");
    str = str.replace("(kandoushi)", "(感動詞)");
    str = str.replace("(jisoumeishi)", "(時間を表す名詞)");
    return str;
}


export async function generateJpVocabCards(props: {
    words: string[],
    variantmap?: VariantMap,
    modules: {
        unihan: Unihan,
        jmdict: Jmdict,
        cedict: Cedict,
        bccwj: Bccwj,
        subtlex: Subtlex,
    }
}): Promise<JapaneseVocabCard[]> {
    const { variantmap, words } = props;
    const { unihan, jmdict, cedict, bccwj, subtlex } = props.modules;
    const converter_s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });
    const { cnSorter } = getCnSorter({ unihan, freq: subtlex })


    function getCnVariantsByChar(char: string): string[] {
        const cid = unihan.getClusterId(char);
        if (!cid) return [];
        let vars = unihan.getClusterById(cid).filter(unihan.isSimplified).filter(isHanCharacter);
        if (variantmap) vars = [...vars, ...(variantmap.getEntryByChar(char)?.simpChineseChar || [])]
        return vars;
    }

    function getVariantCandidates(str: string): string[] {
        const chars: string[] = str.split('');
        const variants: string[][] = chars.map(c => getCnVariantsByChar(c));
        if (variants.some(v => v.length == 0)) return [];

        // initialize candidate map
        const traverse = (root: string, idx: number): string[] => {
            // base case: reached max length, terminate
            if (root.length == chars.length) return [root];
            // otherwise, try the current char + append other options
            return variants[idx]
                .map((v: string): string[] => traverse(root + v, idx + 1))
                .flat();
        }
        if (chars.length == 1) return variants[0];
        return traverse('', 0);
    }
    function getSinoJpCandidates(str: string): string[] {
        const candidates = getVariantCandidates(str);
        return candidates.filter(c => !!cedict.getEntry(c));
    }



    function makeCard(word: string): JapaneseVocabCard | undefined {
        const entries = jmdict.getEntriesByWord(word);
        if (entries.length == 0) return undefined;
        const entry = entries[0]; // TODO: get preferred entry somehow?

        // Get preferred spelling and hiragana
        let prefReading = '';
        let isKana = false;
        if (isUsuallyKana(entry)) {
            prefReading = getPreferredReading(entry);
            isKana = true;
        }
        else {
            prefReading = getPreferredReading(entry);
            isKana = !prefReading.split('').some(c => isHanCharacter(c));
        }

        // Get preferred sense
        const getMeaning = (sense: JmdictSense): string => {
            const glosses = sense.gloss.filter(g => g.lang == JmdictGlossLang.eng);
            const texts: string[] = glosses.map(g => g.text);
            return texts.length > 0 ? texts.join('; ') : '';
        }

        if (entry.sense.length == 0) return undefined;
        const prefSense = entry.sense[0];
        const otherSenses = entry.sense.slice(1);

        // Check if sino-chinese
        let chinese = '';
        if (isHanCharacters(word)) {
            const cnCandidates = getSinoJpCandidates(word);
            cnCandidates.sort(cnSorter);
            if (cnCandidates.length > 0) {
                chinese = cnCandidates[0];

                const pinyin = cedict.getPinyin(chinese)?.[0] || '';
                let trad = '';
                const tradVar = converter_s2t(chinese);
                if (tradVar != chinese) {
                    trad = '/' + tradVar;
                }
                chinese = `${chinese}[${generateAccentPinyinDelim(pinyin, ' ')}]${trad}`;
            }
        }

        // Get frequency if it exists
        let frequency: number | undefined = bccwj.getFrequency(word);
        if (frequency == 0) frequency = undefined;

        // Make tags
        const tags: string[] = [];
        if (isKana) tags.push(k_tag_USUALLY_KANA);

        // Return constructed card
        return {
            word: prefReading,
            hiragana: !isKana ? getPreferredRele(entry) : '',
            chinese,
            meaning: getMeaning(prefSense),
            grammar: prefSense.pos.map(p => jmdict.interpretEntity(p)).map(interpretParens),
            otherMeanings: otherSenses.map(getMeaning),
            frequency,
            sentences: [],
            tags,
        };
    }


    const cards_raw: [string, JapaneseVocabCard | undefined][] = words.map(word => [word, makeCard(word)]);
    console.log("These cards were undefined: ", cards_raw.filter(t => !t[1]).map(t => t[0]))
    const cards: JapaneseVocabCard[] = cards_raw.map(t => t[1]).filter(t => !!t);
    return cards;
}

export async function writeJpVocabCardsToFile(props: {
    filePath: string,
    cards: JapaneseVocabCard[],
}): Promise<void> {
    const {cards, filePath} = props;

    const writeStream = fs.createWriteStream(filePath, {
        flags: 'w', // 'a' to append
        encoding: 'utf8'
    });

    const field_order: (keyof JapaneseVocabCard)[] = [
        'word',
        'hiragana',
        'chinese',
        'meaning',
        'grammar',
        'otherMeanings',
        'sentences',
        'frequency',
    ];

    const col_count = field_order.length + 1;
    writeStream.write("#separator:tab\n");
    writeStream.write("#html:true\n");
    writeStream.write("#notetype column:1\n");
    writeStream.write(`#tags column:${col_count}\n`);

    cards.forEach(card => {
        const k_NOTE_TYPE = "Vocab Japanese";
        let fields: string[] = Array(col_count).fill('');

        const formatFns: { [K in keyof JapaneseVocabCard]: (value: JapaneseVocabCard[K]) => string; } = {
            word: (c: string) => c,
            hiragana: (c: string) => c,
            chinese: (c: string) => c,
            meaning: (c: string) => c,
            grammar: (c: string[]) => c.join('; '),
            otherMeanings: (c: string[]) => c.join(','),
            sentences: (c: string[]) => c.join('<br>'),
            frequency: (n?: number) => n != undefined ? n.toString() : '0',
            tags: (c: string[]) => c.join(' '),
        };
        function formatCardField<K extends keyof JapaneseVocabCard>(key: K, card: JapaneseVocabCard): string {
            return formatFns[key]?.(card[key]) || '';
        }

        for (let i = 0; i < col_count; i++) {
            if (i == 0) {
                fields[i] = k_NOTE_TYPE;
            }
            else if (i <= field_order.length) {
                const key: keyof JapaneseVocabCard = field_order[i - 1];
                fields[i] = formatCardField(key, card) || '';
            }
            else if (i == col_count - 1) {
                fields[i] = formatFns['tags'](card.tags);
            }
        }

        writeStream.write(fields.join('\t') + '\n');
    })
}