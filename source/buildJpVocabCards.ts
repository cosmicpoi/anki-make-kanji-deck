import * as fs from 'fs'
import { Jmdict, JmdictGlossLang, JmdictSense, getPreferredReading, isUsuallyKana, getPreferredRele, getPreferredSense, isArchaic, isObselete, isVulgar, isSlang, getPreferredKele, getReadings } from 'Jmdict';
import { Cedict } from 'modules/Cedict';
import { Unihan } from 'Unihan';
import { Bccwj } from 'Bccwj';
import { isHanCharacter, isHanCharacters } from 'types';
import { getCnSorter, getJpSorter, getSorter } from 'utils/freqCharSort';
import { Subtlex } from 'Subtlex';
import * as OpenCC from 'opencc-js';
import { generateAccentPinyinDelim } from 'utils/pinyin';
import { VariantMap } from 'VariantMap';
import { k_note_VOCAB_JAPANESE, k_tag_LANG_ARCHAIC, k_tag_LANG_OBSELETE, k_tag_LANG_SLANG, k_tag_LANG_VULGAR, k_tag_USUALLY_KANA } from 'consts/consts';
import * as wanakana from 'wanakana';
import { getVariantCandidates } from 'utils/variants';

export type JapaneseVocabCard = {
    word: string;
    hiragana: string;
    romaji: string;
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


export async function buildJpVocabCards(props: {
    words: string[],
    variantMap?: VariantMap,
    modules: {
        unihan: Unihan,
        jmdict: Jmdict,
        cedict: Cedict,
        bccwj: Bccwj,
        subtlex: Subtlex,
    }
}): Promise<JapaneseVocabCard[]> {
    const { variantMap, words } = props;
    const { unihan, jmdict, cedict, bccwj, subtlex } = props.modules;
    const converter_s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });
    const { cnSorter } = getCnSorter({ unihan, freq: subtlex })


    function getCnVariantsByChar(char: string): string[] {
        const cid = unihan.getClusterId(char);
        if (!cid) return [];
        let vars = unihan.getClusterById(cid).filter(unihan.isSimplified).filter(isHanCharacter);
        if (variantMap) vars = [...vars, ...(variantMap.getEntryByChar(char)?.simpChineseChar || [])]
        return vars;
    }

    function getSinoJpCandidates(str: string): string[] {
        const candidates = getVariantCandidates(str, getCnVariantsByChar);
        return candidates.filter(c => !!cedict.getEntry(c));
    }


    const renderedWords: Set<string> = new Set();
    function makeCard(word: string): JapaneseVocabCard | undefined {
        const entries = jmdict.getEntriesByWord(word);
        if (entries.length == 0) return undefined;
        const entry = entries[0]; // TODO: get preferred entry somehow?

        // Get preferred spelling and hiragana
        const romaji = wanakana.toRomaji(getPreferredRele(entry));
        const isKatakana = wanakana.isKatakana(getPreferredKele(entry));

        let prefReading = getPreferredReading(entry);
        const prefKele = getPreferredKele(entry);
        if (!isKatakana && prefKele != '') prefReading = prefKele;

        if (renderedWords.has(prefReading)) return undefined;
        renderedWords.add(prefReading);

        // Get preferred sense
        if (entry.sense.length == 0) return undefined;
        const prefSense = getPreferredSense(entry);
        const otherSenses = entry.sense.filter(e => e != prefSense);

        // Get meaning
        const getMeaning = (sense: JmdictSense): string => {
            const glosses = sense.gloss.filter(g => g.lang == JmdictGlossLang.eng);
            const texts: string[] = glosses.map(g => g.text);
            return texts.length > 0 ? texts.join('; ') : '';
        }

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
        const freqs = getReadings(entry).map(e => bccwj.getFrequency(e)).filter(f => f != 0);
        const frequency: number | undefined = freqs.length != 0 ? Math.max(...freqs): undefined;

        // Make tags
        const tags: string[] = [];
        if (isUsuallyKana(entry) && !isKatakana) tags.push(k_tag_USUALLY_KANA);
        if (isArchaic(prefSense)) tags.push(k_tag_LANG_ARCHAIC);
        if (isObselete(prefSense)) tags.push(k_tag_LANG_OBSELETE);
        if (isVulgar(prefSense)) tags.push(k_tag_LANG_VULGAR);
        if (isSlang(prefSense)) tags.push(k_tag_LANG_SLANG);

        // Return constructed card
        return {
            word: prefReading,
            hiragana: isKatakana ? '' : getPreferredRele(entry),
            romaji,
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
    // console.log("These cards were undefined: ", cards_raw.filter(t => !t[1]).map(t => t[0]))
    const cards: JapaneseVocabCard[] = cards_raw.map(t => t[1]).filter(t => !!t);
    return cards;
}

export async function writeJpVocabCardsToFile(props: {
    filePath: string,
    cards: JapaneseVocabCard[],
    tagGetter?: (card: JapaneseVocabCard) => string[],
    modules: {
        unihan: Unihan;
        bccwj: Bccwj;
    }
}): Promise<void> {
    const { cards, filePath, tagGetter } = props;
    const { unihan, bccwj } = props.modules;
    const { jpSorter } = getJpSorter({ unihan, freq: bccwj });

    // Sort in place
    cards.sort((c1, c2) => c1.romaji.localeCompare(c2.romaji));

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

    const field_order: (keyof JapaneseVocabCard)[] = [
        'word',
        'hiragana',
        'romaji',
        'chinese',
        'meaning',
        'grammar',
        'otherMeanings',
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

        const formatFns: { [K in keyof JapaneseVocabCard]: (value: JapaneseVocabCard[K]) => string; } = {
            word: (c: string) => c,
            hiragana: (c: string) => c,
            romaji: (c: string) => c,
            chinese: (c: string) => c,
            meaning: (c: string) => c,
            grammar: (c: string[]) => c.join('; '),
            otherMeanings: (c: string[]) => c.join(','),
            sentences: (c: string[]) => c.join('<br>'),
            frequency: (n?: number) => n != undefined ? n.toString() : '',
            tags: (c: string[]) => c.join(' '),
        };
        function formatCardField<K extends keyof JapaneseVocabCard>(key: K, card: JapaneseVocabCard): string {
            return formatFns[key]?.(card[key]) || '';
        }

        for (let i = 0; i < col_count; i++) {
            if (i == 0) {
                fields[i] = k_note_VOCAB_JAPANESE;
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