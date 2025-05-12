import * as fs from 'fs'
import { Unihan } from './unihan';
import { Kanjidic } from './kanjidic';
import { CountHandler, FileListEntry, FuzzyArray, KanjiCard, apply_getter_to_arr, apply_multi_getter, card_is_character, combine_without_duplicates, common_elements, concatFuzzyArray, defaultFuzzyArray, fuzzy_empty, fuzzy_first, fuzzy_join, get_default_kanji_card, logCard, make_count_handler, reading_similarity } from './types'
import { KanjiMap } from './KanjiMap';
import { k_SOURCE_FILE_LIST } from './file_list';
import minimist from 'minimist';
import { Cedict } from './cedict';
import { k_CEDICT_FILE_PATH, k_JMDICT_FILE_PATH, k_note_CHINESE_ONLY, k_note_CN_JP, k_note_JAPANESE_ONLY, k_tag_CHINESE_ONLY, k_tag_JAPANESE_ONLY } from './consts';
import * as OpenCC from 'opencc-js';
import { Jmdict } from './jmdict';

const args = minimist(process.argv.slice(2));

// initialize kanji map
let kanji: KanjiMap = new KanjiMap();

// Initialize resources
const unihan = new Unihan();
const kanjidic = new Kanjidic();
const cedict = new Cedict(k_CEDICT_FILE_PATH);
const converter_t2s = OpenCC.Converter({ from: 'hk', to: 'cn' });
const converter_s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });

// Iterate through files and build up list of tags
let tags: Set<String> = new Set(); // list of all tags
let sumEntries = 0;
k_SOURCE_FILE_LIST.forEach((file: FileListEntry): void => {
    // Add tags to list
    file.tags?.forEach(tag => tags.add(tag));
    // read content
    const content = fs.readFileSync(file.path, 'utf-8');
    // trim whitespace
    const stripped_content = content.replace(/\s+/g, "");
    let characters: string[] = stripped_content.split('').filter(c => c.length == 1);
    // iterate through characters and emplace tags
    characters.forEach((mychar: string): void => {
        kanji.emplace_character(mychar, file.type);
        kanji.emplace_tags(mychar, file.tags);
    });
    console.log(`Loaded file ${file.path} with tags ${file.tags} with ${characters.length} characters`);
    sumEntries += characters.length;
});

// Merge duplicate entries
console.log("Merging duplicates");
{
    const duplicates: Set<[string, string]> = new Set();

    const allChars: string[] = kanji.getKeys();
    for (let i = 0; i < allChars.length; i++) {
        for (let j = i + 1; j < allChars.length; j++) {
            const char1 = allChars[i];
            const char2 = allChars[j];
            if (unihan.hasLink(char1, char2)) {
                const ord = [char1, char2];
                ord.sort();
                duplicates.add([ord[0], ord[1]]);
            }
        }
    }

    duplicates.forEach(dup => {
        const [c1, c2] = dup;
        kanji.merge(c1, c2, { warn: false });
    });
}

console.log(`Merged from ${sumEntries} to ${kanji.getKeys().length}`);

// Iterate through all kanji, and populate missing forms

// Fill in japanese, simplified, traditional fields for the targeted entry in two passes
// - First fill in readings (mandarin + japanese)
// - Then fill in simplified/traditional/japanese transliteration
// - Use new transliteration information to find more readings
// - Use new readings to find more transliterations

function populateReadings(card: KanjiCard) {
    const newCard = { ...card };

    // fill in pinyin
    const sources: FuzzyArray[] = [card.simpChineseChar, card.tradChineseChar, card.japaneseChar];

    card.pinyin = apply_multi_getter(unihan.getMandarinPinyin, sources);
    card.onyomi = apply_multi_getter(unihan.getJapaneseOn, sources);
    card.kunyomi = apply_multi_getter(unihan.getJapaneseKun, sources);
}

function populateSimpTradFromJpVariants(card: KanjiCard) {
    // If trad character is empty, guess it from japanese
    if (fuzzy_empty(card.tradChineseChar) && !fuzzy_empty(card.japaneseChar)) {
        card.tradChineseChar = apply_getter_to_arr(unihan.getTradChineseVariants, card.japaneseChar);
    }
    // If trad character is empty, guess it from japanese
    if (fuzzy_empty(card.simpChineseChar) && !fuzzy_empty(card.japaneseChar)) {
        card.simpChineseChar = apply_getter_to_arr(unihan.getSimpChineseVariants, card.japaneseChar);
    }
}

function populateSimpFromTrad(card: KanjiCard) {
    if (fuzzy_empty(card.simpChineseChar) && !fuzzy_empty(card.tradChineseChar)) {
        card.simpChineseChar.v = card.tradChineseChar.v.map(c => converter_t2s(c));
    }
}

function populateTradFromSimp(card: KanjiCard) {
    if (fuzzy_empty(card.tradChineseChar) && !fuzzy_empty(card.simpChineseChar)) {
        card.tradChineseChar.v = card.simpChineseChar.v.map(c => converter_s2t(c));
    }
}


kanji.getCards().forEach(card => populateSimpTradFromJpVariants(card));
kanji.getCards().forEach(card => populateSimpFromTrad(card));
kanji.getCards().forEach(card => populateTradFromSimp(card));

// populate readings
kanji.getCards().forEach(card => populateReadings(card));

function mergeDuplicatesByReading() {
    console.log("Merging duplicates by reading");

    // See which cards are still missing an entry
    const missingChars: string[] = [];
    kanji.getKeys().forEach(char => {
        const card: KanjiCard = kanji.at(char, true);
        if (fuzzy_empty(card.simpChineseChar) || fuzzy_empty(card.tradChineseChar) || fuzzy_empty(card.japaneseChar)) {
            missingChars.push(char);
        }
    });
    console.log("Cards missing an entry:", missingChars.length);

    const duplicates: Set<[string, string]> = new Set();
    for (let i = 0; i < missingChars.length; i++) {
        for (let j = i + 1; j < missingChars.length; j++) {
            const char1: string = missingChars[i];
            const char2: string = missingChars[j];
            const c1: KanjiCard = kanji.at(char1, true);
            const c2: KanjiCard = kanji.at(char2, true);

            const [match, pct] = reading_similarity(c1, c2);
            if (match > 1) {

                // check character mismatch - if any set is disjoint and nonempty, it can't be merged
                const char_mismatch = (a: FuzzyArray, b: FuzzyArray): boolean =>
                    common_elements(a.v, b.v).length == 0 && a.v.length != 0 && b.v.length != 0;
                const m_sp = char_mismatch(c1.simpChineseChar, c2.simpChineseChar);
                const m_td = char_mismatch(c1.tradChineseChar, c2.tradChineseChar);
                const m_jp = char_mismatch(c1.japaneseChar, c2.japaneseChar);

                if (m_sp || m_td || m_jp) continue;

                const ord = [char1, char2];
                ord.sort();
                duplicates.add([ord[0], ord[1]]);
            }
        }
    }

    console.log(`Merged ${duplicates.size} duplicates by similarity`);
    duplicates.forEach(dup => {
        const [c1, c2] = dup;
        kanji.merge(c1, c2, { warn: false });
    });
}

mergeDuplicatesByReading();

// Populate japanese based on semantic alternatives + simp/trad versions
function populateJapSemantic(card: KanjiCard, counter?: CountHandler) {
    if (fuzzy_empty(card.japaneseChar)) {
        const guess_sources: FuzzyArray[] = [card.simpChineseChar, card.tradChineseChar];
        let candidates: FuzzyArray = apply_multi_getter(unihan.getGetSemanticOrSpecializedVariants, guess_sources);
        candidates.v = combine_without_duplicates(candidates.v, card.simpChineseChar.v, card.tradChineseChar.v);
        candidates.v = candidates.v.filter((el) => kanjidic.isKanji(el));

        if (!fuzzy_empty(candidates)) {
            card.japaneseChar = candidates;
            counter?.increment();
        }
    }
}

const japSemanticCounter = make_count_handler();
kanji.getCards().forEach(card => populateJapSemantic(card, japSemanticCounter));
console.log(`Populated ${japSemanticCounter.get()} entries with semantic data`);

// At this point, if we cannot find any japanese character, it's pretty safe to bet it doesn't exist.

// However, there may still be some japanese characters with no chinese equivalents. Time to guess those.

console.log("Guessing empty chinese characters");
function populateSimpTradFromJp(card: KanjiCard, simpCounter?: CountHandler, tradCounter?: CountHandler) {
    if (fuzzy_empty(card.simpChineseChar) && !fuzzy_empty(card.japaneseChar)) {
        const candidates = card.japaneseChar.v.filter(c => cedict.isSimplified(c));
        if (candidates.length != 0) {
            card.simpChineseChar.v = candidates;
            simpCounter?.increment();
        }
    }

    if (fuzzy_empty(card.tradChineseChar) && !fuzzy_empty(card.japaneseChar)) {
        const candidates = card.japaneseChar.v.filter(c => cedict.isTraditional(c));
        if (candidates.length != 0) {
            card.tradChineseChar.v = candidates;
            tradCounter?.increment();
        }
    }
}
const simpCounter = make_count_handler();
const tradCounter = make_count_handler();
kanji.getCards().forEach(card => populateSimpTradFromJp(card, simpCounter, tradCounter));
console.log(`Populated ${simpCounter.get()} simplified and ${tradCounter.get()} traditional characters`);

kanji.getCards().forEach(card => populateSimpFromTrad(card));
kanji.getCards().forEach(card => populateTradFromSimp(card));

// Validate results
// - At least one of the three char types is defined
// - If something is missing, it should either be japanese only or both simp and trad chinese.
// - If jp char exists, on/kun exists
// - If cn char exists, pinyin exists

const onlyJp: KanjiCard[] = [];
const onlyCn: KanjiCard[] = [];
kanji.getCards().forEach(card => {
    // represents if the given char exists
    const jp_e: boolean = !fuzzy_empty(card.japaneseChar);
    const sp_e: boolean = !fuzzy_empty(card.simpChineseChar);
    const td_e: boolean = !fuzzy_empty(card.tradChineseChar);

    const mode_all: boolean = jp_e && sp_e && td_e;
    const mode_jpOnly: boolean = jp_e && !sp_e && !td_e;
    const mode_cnOnly: boolean = !jp_e && sp_e && td_e;

    if (!mode_all && !mode_jpOnly && !mode_cnOnly) {
        console.error("Guess mode invalid");
        logCard("", card);
        return;
    }

    if (mode_cnOnly) {
        onlyCn.push(card);
        card.tags.v.push(k_tag_CHINESE_ONLY);

        if (fuzzy_empty(card.pinyin)) {
            console.error("Pinyin missing");
            logCard("", card);
        }
    }

    if (mode_jpOnly) {
        onlyJp.push(card);
        card.tags.v.push(k_tag_JAPANESE_ONLY);

        if (combine_without_duplicates(card.kunyomi.v, card.onyomi.v).length == 0) {
            console.error("Japanese readings missing");
            logCard("", card);
        }
    }
});

console.log("The following characters only have Japanese entries:");
console.log(onlyJp.map(card => card.japaneseChar.v.join('/')));
console.log("The following characters only have Chinese entries:");
console.log(onlyCn.map(card => combine_without_duplicates(card.simpChineseChar.v, card.tradChineseChar.v))
    .map(chars => chars.join('/')));

// Populate english definitions
kanji.getCards().forEach(card => {
    const allChars = combine_without_duplicates(card.simpChineseChar.v, card.tradChineseChar.v, card.japaneseChar.v);
    const charKey = allChars[0];
    const unihanDefs: string[] = unihan.getEnglishDefinition(charKey);
    const kanjidicDefs: string[] = kanjidic.getEntry(charKey)?.meaning || [];
    const cedictDefs: string[] = cedict.getDefinitions(charKey) || [];

    // prefer unihan => kanjidict => cedict in this order
    if (unihanDefs.length != 0) {
        card.englishMeaning.v = [...unihanDefs];
    }
    else if (kanjidicDefs.length != 0) {
        card.englishMeaning.v = [...kanjidicDefs];
    }
    else if (cedictDefs.length != 0) {
        card.englishMeaning.v = [...cedictDefs];
    }
});

// Export results
if (args['o']) {
    console.log("Writing to file ", args['o']);
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

    // let keys: string[] = [];
    // const jjp = kanji.getCards().filter(c => c.tags.v.includes(k_tag_JAPANESE_ONLY));
    // const ccn = kanji.getCards().filter(c => c.tags.v.includes(k_tag_CHINESE_ONLY));
    // keys = [jjp[0].japaneseChar.v[0], ccn[0].simpChineseChar.v[0], '中'];
    // console.log(keys);

    const keys = kanji.getKeys();
    keys.sort();
    const to_export = keys.map(c => kanji.at(c));
    to_export.forEach(card => {
        // tuple of key, delimiter
        let field_order: [keyof KanjiCard, string][] = jp_cn_field_order;
        let note_type = k_note_CN_JP;
        if (card.tags.v.includes(k_tag_CHINESE_ONLY)) {
            field_order = cn_field_order;
            note_type = k_note_CHINESE_ONLY;
        }
        else if (card.tags.v.includes(k_tag_JAPANESE_ONLY)) {
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
                fields[i] = fuzzy_join(card[key], delim);
            }
            else if (i == col_count - 1) {
                fields[i] = (fuzzy_join(card.tags, ' '));
            }
        }

        const ok = writeStream.write(fields.join('\t') + '\n');

        if (!ok) {
            // Stream buffer is full, wait for drain before continuing
            writeStream.once('drain', () => {
                console.log('Drain event triggered, resuming writes...');
            });
        }
    })

    writeStream.end(() => {
        console.log('Finished writing file.');
    });
}
