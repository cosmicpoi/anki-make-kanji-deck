import { k_BCCWJ_FILE_PATH, k_CEDICT_FILE_PATH, k_JLPT_FILE_LIST, k_WORD_LIST_PATH, k_JMDICT_FILE_PATH, k_UNIHAN_DB_PATH, k_SUBTLEX_FILE_PATH } from 'consts/consts';
import minimist from "minimist";
import { Jmdict, JmdictEntry, JmdictGlossLang, JmdictAbbrevs, JmdictSense, getPreferredReading, isUsuallyKana, getPreferredRele } from 'Jmdict';
import { Cedict } from 'modules/Cedict';
import { Unihan } from 'Unihan';
import { Bccwj } from 'Bccwj';
import { Subtlex } from 'Subtlex';
import { buildJpVocabCards, writeJpVocabCardsToFile } from 'buildJpVocabCards';
import { readFileLines } from 'utils/readFile';

const args = minimist(process.argv.slice(2));

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
    return readFileLines(k_WORD_LIST_PATH + '/' + filePath);
}

async function doThing() {
    const jlptWords = k_JLPT_FILE_LIST.map(path => readFile(path));
    const [jlpt5, jlpt4, jlpt3, jlpt2, jlpt1] = jlptWords;

    const unihan = await Unihan.create(k_UNIHAN_DB_PATH);
    const jmdict = await Jmdict.create(k_JMDICT_FILE_PATH);
    const cedict = await Cedict.create(k_CEDICT_FILE_PATH);
    const bccwj = await Bccwj.create(k_BCCWJ_FILE_PATH);
    const subtlex = await Subtlex.create(k_SUBTLEX_FILE_PATH);
    const modules = { jmdict, cedict, bccwj, subtlex, unihan };

    const cards = await buildJpVocabCards({
        words: jlptWords.flat(),
        modules,
    });

    const jpVocabTags = (card: JapaneseVocabCard): string[] => {
        return [];
    }

    if (args['o']) {
        writeJpVocabCardsToFile({
            filePath: args['o'],
            cards,
            tagGetter: jpVocabTags,
            modules,
        });
    }
}

doThing();