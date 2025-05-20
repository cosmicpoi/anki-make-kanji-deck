import * as fs from 'fs'
import minimist from "minimist";
import { Cedict } from "../source/modules/Cedict";
import {
    k_BCCWJ_FILE_PATH,
    k_CEDICT_FILE_PATH,
    k_CHARACTER_LIST_PATH,
    k_HANZIDB_FILE_PATH,
    k_JINMEIYO_FILE_PATH,
    k_JMDICT_FILE_PATH,
    k_JOYO_FILE_PATH,
    k_KANJIDIC_FILE_PATH,
    k_SUBTLEX_FILE_PATH,
    k_UNIHAN_DB_PATH
} from "../source/consts/consts";
import { Kanjidic } from "Kanjidic";
import { Unihan } from "Unihan";
import { buildKanjiCardsFromLists } from "../source/buildKanjiCards";
import { Bccwj } from "Bccwj";
import { KanjiCard } from "KanjiCard";
import { Hanzidb } from 'Hanzidb';
import { combine_without_duplicates, hskTag, jlptTag } from '../source/types';
import { Jmdict } from 'Jmdict';
import { Subtlex } from 'Subtlex';

const k_tag_CHINESE_ONLY = "chinese_only";
const k_tag_JAPANESE_ONLY = "japanese_only";
const k_tag_CHINESE_RARE = "chinese_rare";
const k_tag_JAPANESE_RARE = "japanese_rare";
const k_tag_JOYO = "jouyou_kanji";
const k_tag_JINMEIYO = "jinmeiyou_kanji";
const k_tag_RADICAL = "radical";

const k_note_CN_JP = "Character Sino-Japanese";
const k_note_CHINESE_ONLY = "Character Chinese";
const k_note_JAPANESE_ONLY = "Character Japanese";

const args = minimist(process.argv.slice(2));

const invisibleChars = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
function getJoyo(): string[] {
    const content = fs.readFileSync(k_CHARACTER_LIST_PATH + '/' + k_JOYO_FILE_PATH, 'utf-8');
    return content.replace(invisibleChars, '').split('\n').filter(c => c != '');
}

function getJinmeiyo(): string[] {
    const content = fs.readFileSync(k_CHARACTER_LIST_PATH + '/' + k_JINMEIYO_FILE_PATH, 'utf-8');
    return content.replace(invisibleChars, '').split('\n').filter(c => c != '').filter(c => c.at(0) != "#");
}

async function buildKanji() {
    // Initialize modules
    const unihan = await Unihan.create(k_UNIHAN_DB_PATH, { validateLinks: true });
    const kanjidic = await Kanjidic.create(k_KANJIDIC_FILE_PATH);
    const hanzidb = await Hanzidb.create(k_HANZIDB_FILE_PATH);
    const cedict = await Cedict.create(k_CEDICT_FILE_PATH);
    const bccwj = await Bccwj.create(k_BCCWJ_FILE_PATH);
    const subtlex = await Subtlex.create(k_SUBTLEX_FILE_PATH);
    const jmdict = await Jmdict.create(k_JMDICT_FILE_PATH);

    const modules = { unihan, kanjidic, hanzidb, cedict, bccwj, subtlex, jmdict };

    // Build character lists
    const joyo = new Set(getJoyo());
    const jinmeiyo = new Set(getJinmeiyo());

    const simpChineseList = combine_without_duplicates(
        hanzidb.getHSKChars(),
        hanzidb.getNMostFrequent(3000)
    );
    const japaneseList = combine_without_duplicates(
        kanjidic.getJLPTChars(),
        kanjidic.getFrequentChars(),
        bccwj.getNMostFrequentChars(3000),
        [...joyo],
        [...jinmeiyo],
    );
    console.log(`Generating list from ${simpChineseList.length} chinese and ${japaneseList.length} japanese characters`);

    const radicals: Set<string> = new Set(unihan.getAllKangxiRadicals().flat());

    // Generate card list
    const {
        cards,
        chineseVocab,
        japaneseVocab,
        sinoJapaneseVocab
    } = buildKanjiCardsFromLists({ japaneseList, simpChineseList, modules });


    // Sort and return
    const getAllChars = (entry: KanjiCard): string[] =>
        combine_without_duplicates(entry.japaneseChar, entry.simpChineseChar, entry.tradChineseChar);
    const pinyinSort = (c: KanjiCard) => {
        const entries = [...c.pinyin];
        entries.sort();
        return entries.join(',');
    }
    const charSort = (c: KanjiCard) => {
        const chars = getAllChars(c);
        chars.sort();
        return chars.join(',');
    }
    cards.sort((c1, c2) => {
        const c = pinyinSort(c1).localeCompare(pinyinSort(c2));
        if (c == 0) {
            return charSort(c1).localeCompare(charSort(c2));
        }
        else return c;
    });

    const simpChineseSet = new Set(simpChineseList);
    const japaneseSet = new Set(japaneseList);

    const isRadical = (c: KanjiCard): boolean => {
        const allChars = getAllChars(c);
        for (const c of allChars) {
            if (radicals.has(c)) return true;
        }
        return false;
    };

    // const { getJpFreqIdx, getCnFreqIdx } = getSorter({ unihan, jpFreq: bccwj, cnFreq: subltex });
    // const freq_threshold = 300;

    let numRareJp = 0;
    let numRareCn = 0;

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
        const has_jp = card.japaneseChar.map(e => japaneseSet.has(e)).reduce((a, b) => a || b, false);
        const has_cn = card.simpChineseChar.map(e => simpChineseSet.has(e)).reduce((a, b) => a || b, false);
        // const jp_rare = card.japaneseChar.map(e => getJpFreqIdx(e)).reduce((a, b) => Math.max(a, b), 0) < freq_threshold;
        // const cn_rare = card.simpChineseChar.map(e => getCnFreqIdx(e)).reduce((a, b) => Math.max(a, b), 0) < freq_threshold;
        if (card.japaneseChar.length > 0 && !has_jp) {
            card.tags.push(k_tag_JAPANESE_RARE);
            numRareJp++;
        }
        if (card.simpChineseChar.length > 0 && !has_cn) {
            card.tags.push(k_tag_CHINESE_RARE);
            numRareCn++;
        }
        // Add jinmeiyo and joyo tags
        if (card.japaneseChar.length > 0 && card.japaneseChar.some(c => joyo.has(c))) {
            card.tags.push(k_tag_JOYO);
        }
        if (card.japaneseChar.length > 0 && card.japaneseChar.some(c => jinmeiyo.has(c))) {
            card.tags.push(k_tag_JINMEIYO);
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

        const formatFns: { [K in keyof KanjiCard]: (value: KanjiCard[K]) => string; } = {
            japaneseChar: (c: string[]) => c.join(','),
            simpChineseChar: (c: string[]) => c.join(','),
            tradChineseChar: (c: string[]) => c.join(','),
            pinyin: (c: string[]) => c.join(','),
            kunyomi: (c: string[]) => c.join(','),
            onyomi: (c: string[]) => c.join(','),
            englishMeaning: (c: string[]) => c.join('; '),
            japaneseKunVocab: (c: string[]) => c.map(w => `<p>${w}</p>`).join(''),
            japaneseOnVocab: (c: string[]) => c.map(w => `<p>${w}</p>`).join(''),
            chineseVocab: (c: string[]) => c.map(w => `<p>${w}</p>`).join(''),
            japaneseFrequency: (n?: number) => n != undefined ? n.toString() : '0',
            chineseFrequency: (n?: number) => n != undefined ? n.toString() : '0',
            japaneseStrokeCount: (n?: number) => n != undefined ? n.toString() : '0',
            chineseStrokeCount: (n?: number) => n != undefined ? n.toString() : '0',
            tags: (c: string[]) => c.join(' '),
        };
        function formatCardField<K extends keyof KanjiCard>(key: K, card: KanjiCard): string {
            return formatFns[key]?.(card[key]) || '';
        }

        // No need to specify tags, it always goes at the end
        const jp_cn_field_order: (keyof KanjiCard)[] = [
            'japaneseChar',
            'simpChineseChar',
            'tradChineseChar',
            'pinyin',
            'kunyomi',
            'onyomi',
            'englishMeaning',
            'japaneseKunVocab',
            'japaneseOnVocab',
            'chineseVocab',
            'japaneseFrequency',
            'chineseFrequency',
            'japaneseStrokeCount',
            'chineseStrokeCount',
        ];

        const jp_field_order: (keyof KanjiCard)[] = [
            'japaneseChar',
            'pinyin',
            'kunyomi',
            'onyomi',
            'englishMeaning',
            'japaneseKunVocab',
            'japaneseOnVocab',
            'japaneseFrequency',
            'japaneseStrokeCount',
        ];

        const cn_field_order: (keyof KanjiCard)[] = [
            'simpChineseChar',
            'tradChineseChar',
            'pinyin',
            'englishMeaning',
            'chineseVocab',
            'chineseFrequency',
            'chineseStrokeCount',
        ];

        const col_count = jp_cn_field_order.length + 2;
        writeStream.write("#separator:tab\n");
        writeStream.write("#html:true\n");
        writeStream.write("#notetype column:1\n");
        writeStream.write(`#tags column:${col_count}\n`);

        cards.forEach(card => {
            // tuple of key, delimiter
            let field_order: (keyof KanjiCard)[] = jp_cn_field_order;
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
                    const key: keyof KanjiCard = field_order[i - 1];
                    fields[i] = formatCardField(key, card) || '';
                }
                else if (i == col_count - 1) {
                    fields[i] = formatFns['tags'](card.tags);
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