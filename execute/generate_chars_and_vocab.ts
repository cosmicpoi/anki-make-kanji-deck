import * as fs from 'fs'
import minimist from "minimist";
import { Cedict } from "../source/modules/Cedict";
import {
    k_BCCWJ_FILE_PATH,
    k_CEDICT_FILE_PATH,
    k_CHARACTER_LIST_PATH,
    k_HANZIDB_FILE_PATH,
    k_HSK_FILE_LIST,
    k_JINMEIYO_FILE_PATH,
    k_JLPT_FILE_LIST,
    k_JMDICT_FILE_PATH,
    k_JOYO_FILE_PATH,
    k_KANJIDIC_FILE_PATH,
    k_SUBTLEX_FILE_PATH,
    k_tag_HSK_7_9,
    k_tag_JINMEIYO,
    k_tag_JOYO,
    k_UNIHAN_DB_PATH,
    k_WORD_LIST_PATH
} from "../source/consts/consts";
import { Kanjidic } from "Kanjidic";
import { Unihan } from "Unihan";
import { buildKanjiCardsFromLists, writeKanjiCardsToFile } from "../source/buildKanjiCards";
import { Bccwj } from "Bccwj";
import { KanjiCard } from "KanjiCard";
import { Hanzidb } from 'Hanzidb';
import { combine_without_duplicates, freqTag5k, hskTag, isHanCharacter, jlptTag } from '../source/types';
import { Jmdict } from 'Jmdict';
import { Subtlex } from 'Subtlex';
import { buildJpVocabCards, JapaneseVocabCard, writeJpVocabCardsToFile } from 'buildJpVocabCards';
import { readFileLines } from 'utils/readFile';
import { buildCnVocabCards, ChineseVocabCard, writeCnVocabCardsToFile } from 'buildCnVocabCards';


const args = minimist(process.argv.slice(2));

console.log(args);
const withTags: boolean = !!args['t'];

console.log("With tags:", withTags);

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
    const joyo = new Set(readFileLines(k_CHARACTER_LIST_PATH + '/' + k_JOYO_FILE_PATH));
    const jinmeiyo = new Set(readFileLines(k_CHARACTER_LIST_PATH + '/' + k_JINMEIYO_FILE_PATH));

    const japaneseList = combine_without_duplicates(
        kanjidic.getJLPTChars(),
        kanjidic.getFrequentChars(),
        bccwj.getNMostFrequentChars(3000),
        [...joyo],
        [...jinmeiyo],
    );

    const hsk7_9 = new Set(readFileLines(k_CHARACTER_LIST_PATH + '/' + 'HSK__7-9.txt'));
    const simpChineseList = combine_without_duplicates(
        hanzidb.getHSKChars(),
        hanzidb.getNMostFrequent(3000),
        [...hsk7_9]
    );
    console.log(`Generating list from ${simpChineseList.length} chinese and ${japaneseList.length} japanese characters`);

    // Generate character card list
    const {
        cards: charCards,
        chineseVocab,
        japaneseVocab,
        sinoJapaneseVocab: _sjv,
        variantMap
    } = buildKanjiCardsFromLists({ japaneseList, simpChineseList, modules });

    const charTagGetter = (card: KanjiCard): string[] => {
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
        else if (card.simpChineseChar.some(c => hsk7_9.has(c))) {
            tags.push(k_tag_HSK_7_9);
        }

        return tags;
    };

    // Generate jp vocab card list
    const jlptWords = k_JLPT_FILE_LIST.map(path => readFileLines(k_WORD_LIST_PATH + '/' + path));
    const [n5, n4, n3, n2, n1] = jlptWords.map(w => new Set(w));

    const jpShort = [...japaneseVocab].filter(s =>
        s.split('').filter(isHanCharacter).length <= 4
    );
    const jpWords = combine_without_duplicates(
        jpShort,
        jlptWords.flat(),
        readFileLines(k_WORD_LIST_PATH + '/' + 'Japanese_Basic.txt'),
        bccwj.getNMostFrequentWords(30000),
    );

    // Generate jp vocab cards
    const jpVocabCards = await buildJpVocabCards({ words: jpWords, variantMap, modules })

    const jpVocabTagGetter = (card: JapaneseVocabCard): string[] => {
        const tags = [];
        if (n5.has(card.word)) tags.push(jlptTag(5));
        else if (n4.has(card.word)) tags.push(jlptTag(4));
        else if (n3.has(card.word)) tags.push(jlptTag(3));
        else if (n2.has(card.word)) tags.push(jlptTag(2));
        else if (n1.has(card.word)) tags.push(jlptTag(1));

        const freqRank = bccwj.getFrequencyRank(card.word);
        if (freqRank != 0) {
            const freqTag = freqTag5k(freqRank, "jp_");
            if (freqTag) tags.push(freqTag);
        }
        return tags;
    }

    // Generate CN vocab list
    const hskWords = k_HSK_FILE_LIST.map(path => readFileLines(k_WORD_LIST_PATH + '/' + path));
    const [hsk1, hsk2, hsk3, hsk4, hsk5, hsk6] = hskWords.map(w => new Set(w));
    const cnWords = combine_without_duplicates(
        [...chineseVocab],
        hskWords.flat(),
        [...hsk7_9],
        subtlex.getNMostFrequentWords(30000),
    );


    // Generate cn vocab cards
    const cnVocabCards = await buildCnVocabCards({ words: cnWords, variantMap, modules });
    const cnVocabTagGetter = (card: ChineseVocabCard): string[] => {
        const tags = [];
        if (hsk1.has(card.simplified)) tags.push(hskTag(1));
        else if (hsk2.has(card.simplified)) tags.push(hskTag(2));
        else if (hsk3.has(card.simplified)) tags.push(hskTag(3));
        else if (hsk4.has(card.simplified)) tags.push(hskTag(4));
        else if (hsk5.has(card.simplified)) tags.push(hskTag(5));
        else if (hsk6.has(card.simplified)) tags.push(hskTag(6));

        const freqRank = subtlex.getFrequencyRank(card.simplified);
        if (freqRank != 0) {
            const freqTag = freqTag5k(freqRank, "cn_");
            if (freqTag) tags.push(freqTag);
        }
        return tags;
    }

    // Write to file
    if (args['o']) {
        writeKanjiCardsToFile({
            filePath: args['o'] + "_chars.txt",
            japaneseList,
            simpChineseList,
            cards: charCards,
            modules,
            withTags,
            tagGetter: charTagGetter,
        });
        writeJpVocabCardsToFile({
            filePath: args['o'] + "_jpvocab.txt",
            cards: jpVocabCards,
            modules,
            withTags,
            tagGetter: jpVocabTagGetter,
        })
        writeCnVocabCardsToFile({
            filePath: args['o'] + "_cnvocab.txt",
            cards: cnVocabCards,
            modules,
            withTags,
            tagGetter: cnVocabTagGetter,
        })
    }
}

buildKanji();