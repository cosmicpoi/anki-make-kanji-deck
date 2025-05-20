import { k_BCCWJ_FILE_PATH, k_CEDICT_FILE_PATH, k_JLPT_FILE_LIST, k_WORD_LIST_PATH, k_JMDICT_FILE_PATH, k_UNIHAN_DB_PATH, k_SUBTLEX_FILE_PATH } from 'consts/consts';
import minimist from "minimist";
import * as fs from 'fs'
import { Jmdict, JmdictEntry, JmdictGlossLang, JmdictAbbrevs, JmdictSense, getPreferredReading, isUsuallyKana, getPreferredRele } from 'Jmdict';
import { Cedict } from 'modules/Cedict';
import { Unihan } from 'Unihan';
import { Bccwj } from 'Bccwj';
import { isHanCharacter, isHanCharacters } from 'types';
import { getCnSorter, getSorter } from 'utils/freqCharSort';
import { Subtlex } from 'Subtlex';
import * as OpenCC from 'opencc-js';
import { generateAccentPinyinDelim } from 'utils/pinyin';
import { VariantMap } from 'VariantMap';
import { generateJpVocabCards } from 'buildJpVocabCards';

const args = minimist(process.argv.slice(2));

const k_tag_USUALLY_KANA = "usually_kana";

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

function readFile(filePath: string): string[] {
    const invisibleChars = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
    const content = fs.readFileSync(k_WORD_LIST_PATH + '/' + filePath, 'utf-8');
    return content.replace(invisibleChars, '').split('\n').filter(c => c != '');
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



async function generateCards(variantmap: VariantMap | undefined = undefined): Promise<JapaneseVocabCard[]> {


}

async function doThing() {
    const jlptWords = k_JLPT_FILE_LIST.map(path => readFile(path));
    const [jlpt5, jlpt4, jlpt3, jlpt2, jlpt1] = jlptWords;

    const unihan = await Unihan.create(k_UNIHAN_DB_PATH);
    const jmdict = await Jmdict.create(k_JMDICT_FILE_PATH);
    const cedict = await Cedict.create(k_CEDICT_FILE_PATH);
    const bccwj = await Bccwj.create(k_BCCWJ_FILE_PATH);
    const subtlex = await Subtlex.create(k_SUBTLEX_FILE_PATH);


    const cards = await generateJpVocabCards({
        words: jlptWords.flat(),
        modules: {
            jmdict, cedict, bccwj, subtlex, unihan
        }
    });
    
    if (args['o']) {
        const writeStream = fs.createWriteStream(args['o'], {
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
}

doThing();