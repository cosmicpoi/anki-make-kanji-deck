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
    k_tag_JINMEIYO,
    k_tag_JOYO,
    k_UNIHAN_DB_PATH
} from "../source/consts/consts";
import { Kanjidic } from "Kanjidic";
import { Unihan } from "Unihan";
import { buildKanjiCardsFromLists, writeKanjiCardsToFile } from "../source/buildKanjiCards";
import { Bccwj } from "Bccwj";
import { KanjiCard } from "KanjiCard";
import { Hanzidb } from 'Hanzidb';
import { combine_without_duplicates, hskTag, jlptTag } from '../source/types';
import { Jmdict } from 'Jmdict';
import { Subtlex } from 'Subtlex';


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

    // Generate card list
    const {
        cards,
        chineseVocab,
        japaneseVocab,
        sinoJapaneseVocab
    } = buildKanjiCardsFromLists({ japaneseList, simpChineseList, modules });

    const tagGetter = (card: KanjiCard): string[] => {
        const tags: string[] = [];
        // Add jinmeiyo and joyo tags
        if (card.japaneseChar.length > 0 && card.japaneseChar.some(c => joyo.has(c))) {
            tags.push(k_tag_JOYO);
        }
        if (card.japaneseChar.length > 0 && card.japaneseChar.some(c => jinmeiyo.has(c))) {
            tags.push(k_tag_JINMEIYO);
        }

        const jlptLevels = card.japaneseChar.map(c => kanjidic.getJLPT(c));
        const minJlptLevel = jlptLevels.length == 0 ? 0 : jlptLevels.reduce((a, b) => Math.min(a, b));
        if (minJlptLevel != 0) {
            tags.push(jlptTag(minJlptLevel));
        }

        const hskLevels = card.simpChineseChar.map(c => hanzidb.getHSK(c));
        const maxHskLevel = hskLevels.reduce((a, b) => Math.max(a, b), 0);
        if (maxHskLevel != 0) {
            tags.push(hskTag(maxHskLevel));
        }
        return tags;
    };

    if (args['o']) {
        writeKanjiCardsToFile({
            filePath: args['o'],
            japaneseList,
            simpChineseList,
            cards,
            modules,
            tagGetter,
        });
    }
}

buildKanji();