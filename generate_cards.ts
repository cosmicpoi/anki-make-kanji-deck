import * as fs from 'fs'
import minimist from "minimist";
import { Cedict } from "./cedict";
import { k_BCCWJ_FILE_PATH, k_BCLU_FILE_PATH, k_CEDICT_FILE_PATH, k_CHARACTER_LIST_PATH, k_HANZIDB_FILE_PATH, k_HSK_FILE_LIST, k_JLPT_FILE_LIST, k_JMDICT_FILE_PATH, k_KANJIDIC_FILE_PATH, k_note_CHINESE_ONLY, k_note_CN_JP, k_note_JAPANESE_ONLY, k_tag_CHINESE_ONLY, k_tag_CHINESE_RARE, k_tag_JAPANESE_ONLY, k_tag_JAPANESE_RARE, k_tag_RADICAL, k_UNIHAN_DB_PATH } from "./consts";
import { Kanjidic } from "./kanjidic";
import { Unihan } from "./unihan";
import { buildKanjiCardsFromLists } from "./buildKanjiCards";
import { Bccwj } from "./bccwj";
import { KanjiCard } from "./KanjiCard";
import { Bclu } from "./Bclu";
import { Hanzidb } from './Hanzidb';
import { array_difference, combine_without_duplicates, hskTag, jlptTag } from './types';

const args = minimist(process.argv.slice(2));

async function buildKanji() {
    const unihan = await Unihan.create(k_UNIHAN_DB_PATH);
    const kanjidic = await Kanjidic.create(k_KANJIDIC_FILE_PATH);
    const hanzidb = await Hanzidb.create(k_HANZIDB_FILE_PATH);
    const cedict = new Cedict(k_CEDICT_FILE_PATH);
    const bccwj = await Bccwj.create(k_BCCWJ_FILE_PATH);
    const bclu = await Bclu.create(k_BCLU_FILE_PATH);

    const simpChineseList = combine_without_duplicates(hanzidb.getHSKChars(), hanzidb.getNMostFrequent(3000));
    const japaneseList = kanjidic.getJLPTChars();
    console.log(`Generating list from ${simpChineseList.length} chinese and ${japaneseList.length} japanese characters`);

    // Generate card list
    const cards: KanjiCard[] = buildKanjiCardsFromLists({
        fileListDir: k_CHARACTER_LIST_PATH,
        japaneseList,
        simpChineseList,
        modules: { unihan, kanjidic, cedict, bccwj, bclu }
    });

    const radicals: Set<string> =  new Set(unihan.getAllKangxiRadicals().flat());

    const simpChineseSet = new Set(simpChineseList);
    const japaneseSet = new Set(japaneseList);

    const getAllChars = (entry: KanjiCard): string[] =>
        combine_without_duplicates(entry.japaneseChar, entry.simpChineseChar, entry.tradChineseChar);
    const isRadical = (c: KanjiCard): boolean => {
        const allChars = getAllChars(c);
        for (const c of allChars) {
            if (radicals.has(c)) return true;
        }
        return false;
    };


    // Add tags
    cards.forEach(card => {
        // Add radical tags
        if (isRadical(card)) {
            card.tags.push(k_tag_RADICAL);
        }
        // Add chinese-only or japanese-only tags
        if (card.japaneseChar.length == 0) {
            card.tags.push(k_tag_CHINESE_ONLY);
        }
        else if (card.simpChineseChar.length == 0 && card.tradChineseChar.length == 0) {
            card.tags.push(k_tag_JAPANESE_ONLY);
        }
        // Add chinese-rare or japanese-rare tags
        if (card.japaneseChar.length > 0 && !japaneseSet.has(card.japaneseChar[0])) {
            card.tags.push(k_tag_JAPANESE_RARE);
        }
        if (card.simpChineseChar.length > 0 && !simpChineseSet.has(card.simpChineseChar[0])) {
            card.tags.push(k_tag_CHINESE_RARE);
        }
    });

    // Populate JLPT / HSK levels
    cards.forEach(card => {
        const jlptLevels = card.japaneseChar.map(c => kanjidic.getJLPT(c));
        const minJlptLevel = jlptLevels.length == 0 ? 0 : jlptLevels.reduce((a, b) => Math.min(a, b));
        if (minJlptLevel != 0) {
            card.tags.push(jlptTag(minJlptLevel));
        }

        const hskLevels = card.simpChineseChar.map(c => hanzidb.getHSK(c));
        const maxHskLevel = hskLevels.reduce((a, b) => Math.max(a, b), 0);
        if (maxHskLevel != 0) {
            card.tags.push(hskTag(maxHskLevel));
        }
    });

    // Now write to file

    if (args['o']) {
        const writeStream = fs.createWriteStream(args['o'], {
            flags: 'w', // 'a' to append
            encoding: 'utf8'
        });

        // No need to specify tags, it always goes at the end
        const jp_cn_field_order: [keyof KanjiCard, string][] = [
            ['japaneseChar', ','],
            ['simpChineseChar', ','],
            ['tradChineseChar', ','],
            ['pinyin', ','],
            ['kunyomi', ','],
            ['onyomi', ','],
            ['japaneseKunVocab', ','],
            ['japaneseOnVocab', ','],
            ['englishMeaning', ','],
        ];

        const jp_field_order: [keyof KanjiCard, string][] = [
            ['japaneseChar', ','],
            ['kunyomi', ','],
            ['onyomi', ','],
            ['englishMeaning', ','],
            ['japaneseKunVocab', ','],
            ['japaneseOnVocab', ','],
        ];

        const cn_field_order: [keyof KanjiCard, string][] = [
            ['simpChineseChar', ','],
            ['tradChineseChar', ','],
            ['pinyin', ','],
            ['englishMeaning', ','],
        ];

        const col_count = jp_cn_field_order.length + 2;
        writeStream.write("#separator:tab\n");
        writeStream.write("#html:true\n");
        writeStream.write("#notetype column:1\n");
        writeStream.write(`#tags column:${col_count}\n`);

        cards.forEach(card => {
            // tuple of key, delimiter
            let field_order: [keyof KanjiCard, string][] = jp_cn_field_order;
            let note_type = k_note_CN_JP;
            if (card.tags.includes(k_tag_CHINESE_ONLY)) {
                field_order = cn_field_order;
                note_type = k_note_CHINESE_ONLY;
            }
            else if (card.tags.includes(k_tag_JAPANESE_ONLY)) {
                field_order = jp_field_order;
                note_type = k_note_JAPANESE_ONLY;
            }

            let fields: string[] = Array(col_count).fill('');

            for (let i = 0; i < col_count; i++) {
                if (i == 0) {
                    fields[i] = note_type;
                }
                else if (i <= field_order.length) {
                    const [key, delim] = field_order[i - 1];
                    if (key != 'strokeCount' && key != 'japaneseDifficulty' && key != 'simpChineseDifficulty') {
                        fields[i] = card[key].join(delim);
                    }
                    else {
                        fields[i] = card[key] != undefined ? card[key].toString() : '';
                    }
                }
                else if (i == col_count - 1) {
                    fields[i] = card.tags.join(' ');
                }
            }

            writeStream.write(fields.join('\t') + '\n');
        })

        writeStream.end(() => {
            console.log('Finished writing file.');
        });
    }
}

buildKanji();