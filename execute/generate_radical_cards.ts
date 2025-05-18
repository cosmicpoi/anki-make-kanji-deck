import * as fs from 'fs'
import minimist from "minimist";
import { Bclu } from "Bclu";
import { k_BCLU_FILE_PATH, k_NUM_KANGXI_RADICALS, k_UNIHAN_DB_PATH } from "consts/consts";
import { isHanCharacter, isSameArray } from "types";
import { Unihan } from "Unihan";
import { getCnSorter } from "utils/freqCharSort";

const args = minimist(process.argv.slice(2));

type RadicalCard = {
    character: string;
    alternateForms: string[];
    pinyin: string[];
    japaneseReadings: string[];
    kangxiNumber: number;
    ancientCharacter: string;
    englishMeaning: string;
    examples: string[];
}

const defaultRadicalCard = (): RadicalCard => ({
   character: '',
    alternateForms: [],
    pinyin: [],
    japaneseReadings: [],
    kangxiNumber: 0,
    ancientCharacter: '',
    englishMeaning: '',
    examples: [],
});

const isCompatability = (char: string): boolean => {
    const code = char.charCodeAt(0);
    // CJK Compatibility Ideographs (U+F900 through U+FAD9)
    if (code >= 0xF900 && code <= 0xFAD9) return true;
    return false;
}

async function doThing() {
    const unihan = await Unihan.create(k_UNIHAN_DB_PATH);
    const bclu = await Bclu.create(k_BCLU_FILE_PATH);

    const cards: Record<number, RadicalCard> = {};
    const { cnSorter } = getCnSorter({ unihan, freq: bclu });
    for (let i = 1; i <= k_NUM_KANGXI_RADICALS; i++) {
        let rads = unihan.getKangxiRadicals(i).map(e => e.glyph);
        rads = [...new Set(rads)];
        rads = rads.filter(isHanCharacter);
        rads = rads.filter(c => !isCompatability(c));
        rads = rads.filter(c => unihan.isSimplified(c) || unihan.isTraditional(c) || unihan.isJapanese(c));
        rads.sort(cnSorter);
        console.log(rads);

        // Derive fields
        const char = rads[0];
        const pinyin = unihan.getMandarinPinyin(char);

        // Typeset alternate forms
        const alternateForms = rads.slice(1).map(r => {
            let pinyinStr = '';
            const pinyinCandidates = unihan.getMandarinPinyin(r);
            if (!isSameArray(pinyinCandidates, pinyin)) {
                pinyinStr = `[${pinyinCandidates.join(',')}]`;
            }
            return `${r}${pinyinStr}`;
        });

        // Get meaning
        const meanings = unihan.getEnglishDefinition(char);
        let meaning = meanings.join(';').replace(/Kangxi radical \d+/, '');
        if (meaning.slice(-1).match(/;|,/)) meaning = meaning.slice(0, -1);

        // Get examples
        let examples = unihan.getCharsByRadicalNo(i);
        examples.sort(cnSorter);
        examples = examples.filter(isHanCharacter);
        examples = examples.slice(0, 10);

        // Set card
        cards[i] = {
            character: char,
            pinyin,
            alternateForms,
            japaneseReadings: [
                ...unihan.getJapaneseKun(char), 
                ...unihan.getJapaneseOn(char)
            ],
            kangxiNumber: i,
            ancientCharacter: `<img src="${char}_img_ancient.svg">`,
            englishMeaning: meaning,
            examples,
        };
    }

    // Export
    if (args['o']) {
        const writeStream = fs.createWriteStream(args['o'], {
            flags: 'w', // 'a' to append
            encoding: 'utf8'
        });

        const field_order: (keyof RadicalCard)[] = [
            'character',
            'pinyin',
            'alternateForms',
            'japaneseReadings',
            'englishMeaning',
            'examples',
            'ancientCharacter',
            'kangxiNumber',
        ];


        const col_count = Object.keys(field_order).length + 1;
        writeStream.write("#separator:tab\n");
        writeStream.write("#html:true\n");
        writeStream.write("#notetype column:1\n");

        const k_NOTE_TYPE = "Radical";

        for (let i = 1; i <= k_NUM_KANGXI_RADICALS; i++) {
            const card = cards[i];
            let fields: string[] = Array(col_count).fill('');

            for (let i = 0; i < col_count; i++) {
                if (i == 0) {
                    fields[i] = k_NOTE_TYPE;
                }
                else if (i <= field_order.length) {
                    const key: keyof RadicalCard = field_order[i - 1];
                    if (typeof card[key] == 'string') {
                        fields[i] = card[key];
                    }
                    else if (typeof card[key] == 'number') {
                        fields[i] = card[key].toString();
                    }
                    else {
                        fields[i] = card[key].join(', ');
                    }
                }
            }

            writeStream.write(fields.join('\t') + '\n');
        }

        writeStream.end(() => {
            console.log('Finished writing file.');
        });
    }
}

doThing();