import { k_CEDICT_FILE_PATH, k_JLPT_FILE_LIST, k_JLPT_WORD_LIST_PATH, k_JMDICT_FILE_PATH, k_UNIHAN_DB_PATH } from 'consts/consts';
import minimist from "minimist";
import * as fs from 'fs'
import { Jmdict } from 'Jmdict';
import { Cedict } from 'modules/Cedict';
import { Unihan } from 'Unihan';

const args = minimist(process.argv.slice(2));

type ChineseVocabCard = {
    word: string;
    hiragana: string;
    chinese: string;
    meaning: string;
    grammar: string;
    otherMeanings: string[];
    sentences: string[];
    tags: string[];
    frequency?: number;
}

function readFile(fileDir: string, filePath: string): string[] {
    const invisibleChars = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
    const content = fs.readFileSync(fileDir + '/' + filePath, 'utf-8');
    return content.replace(invisibleChars, '').split('\n').filter(c => c != '');
}

const readJlpt = (filePath: string): string[] => readFile(k_JLPT_WORD_LIST_PATH, filePath);

async function generateCards() {
    const unihan = await Unihan.create(k_UNIHAN_DB_PATH);
    const jmdict = await Jmdict.create(k_JMDICT_FILE_PATH);
    const cedict = await Cedict.create(k_CEDICT_FILE_PATH);

    const jlptWords = k_JLPT_FILE_LIST.map(path => readJlpt(path));
    const [jlpt5, jlpt4, jlpt3, jlpt2, jlpt1] = jlptWords;

    const cards: ChineseVocabCard[] = [];


    if (args['o']) {
        const writeStream = fs.createWriteStream(args['o'], {
            flags: 'w', // 'a' to append
            encoding: 'utf8'
        });


        const field_order: (keyof ChineseVocabCard)[] = [
            'chinese',
        ];
        const col_count = field_order.length + 1;
        writeStream.write("#separator:tab\n");
        writeStream.write("#html:true\n");
        writeStream.write("#notetype column:1\n");
        writeStream.write(`#tags column:${col_count}\n`);

        cards.forEach(card => {
            const k_NOTE_TYPE = "Vocab Japanese";
            let fields: string[] = Array(col_count).fill('');

            const formatFns: { [K in keyof ChineseVocabCard]: (value: ChineseVocabCard[K]) => string; } = {
                word: (c: string) => c,
                hiragana: (c: string) => c,
                chinese: (c: string) => c,
                meaning: (c: string) => c,
                grammar: (c: string) => c,
                otherMeanings: (c: string[]) => c.join(','),
                sentences: (c: string[]) => c.join('<br>'),
                frequency: (n?: number) => n != undefined ? n.toString() : '0',
                tags: (c: string[]) => c.join(' '),
            };
            function formatCardField<K extends keyof ChineseVocabCard>(key: K, card: ChineseVocabCard): string {
                return formatFns[key]?.(card[key]) || '';
            }

            for (let i = 0; i < col_count; i++) {
                if (i == 0) {
                    fields[i] = k_NOTE_TYPE;
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
}

generateCards();