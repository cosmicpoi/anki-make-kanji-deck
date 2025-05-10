import * as fs from 'fs'
import { Unihan } from './unihan';
import { Kanjidic } from './kanjidic';
import { FileListEntry, FuzzyArray, KanjiCard, apply_multi_getter, card_is_character, combine_without_duplicates, common_elements, concatFuzzyArray, defaultFuzzyArray, fuzzy_empty, fuzzy_first, fuzzy_join, get_default_kanji_card, logCard, reading_similarity } from './types'
import { KanjiMap } from './KanjiMap';
import { k_SOURCE_FILE_LIST } from './file_list';
import minimist from 'minimist';


//------------------------------------------------------------------------------
// Helper function
//------------------------------------------------------------------------------


//------------------------------------------------------------------------------
// Script
//------------------------------------------------------------------------------

const args = minimist(process.argv.slice(2));

// Initialize Unihan DB and Kanji Map
const unihan = new Unihan();
const kanjidic = new Kanjidic();
let kanji: KanjiMap = new KanjiMap();

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
    let characters: string[] = stripped_content.split('');
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

    const allChars: string[] = kanji.getChars();
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

console.log(`Merged from ${sumEntries} to ${kanji.getChars().length}`);

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

function populateSimpTrad(card: KanjiCard) {
    const newCard: Partial<KanjiCard> = {};
    // If we can't find a trad chinese character, fill it in
    if (fuzzy_empty(card.tradChineseChar)) {
        const guess_sources: FuzzyArray[] = [card.simpChineseChar, card.japaneseChar];
        newCard.tradChineseChar = apply_multi_getter(unihan.getTradChineseVariants, guess_sources);

        // If it's STILL empty, just use the simplified chinese version 
        if (fuzzy_empty(newCard.tradChineseChar) && !fuzzy_empty(card.simpChineseChar)) {
            newCard.tradChineseChar.v = card.simpChineseChar.v;
        }
    }
    // If we can't find a simp chinese character, fill it in
    if (fuzzy_empty(card.simpChineseChar)) {
        const guess_sources: FuzzyArray[] = [card.tradChineseChar, card.japaneseChar];
        newCard.simpChineseChar = apply_multi_getter(unihan.getSimpChineseVariants, guess_sources);

        // If it's STILL empty, just use the trad chinese version 
        if (fuzzy_empty(newCard.simpChineseChar) && !fuzzy_empty(card.tradChineseChar)) {
            newCard.simpChineseChar.v = card.tradChineseChar.v;
        }
    }

    if (newCard.simpChineseChar) card.simpChineseChar = newCard.simpChineseChar;
    if (newCard.tradChineseChar) card.tradChineseChar = newCard.tradChineseChar;
}

function populateJapSemantic(card: KanjiCard) {
    const newCard: Partial<KanjiCard> = {};
    // If the japanese does not exist, try to derive it from simp/trad
    if (fuzzy_empty(card.japaneseChar)) {
        const guess_sources: FuzzyArray[] = [card.simpChineseChar, card.tradChineseChar];
        let candidates: FuzzyArray = apply_multi_getter(unihan.getGetSemanticOrSpecializedVariants, guess_sources);
        candidates.v = candidates.v.filter((el) => kanjidic.isKanji(el));
        // candidates = combine_without_duplicates()

        newCard.japaneseChar = candidates;
        if (!fuzzy_empty(candidates)) {
            newCard.japaneseChar.guess = true;
        }
    }

    if (newCard.japaneseChar) card.japaneseChar = newCard.japaneseChar;
}

kanji.getChars().forEach(char => {
    const card: KanjiCard = kanji.at(char, true);
    // logCard("Populating card:", card);
    populateReadings(card);
    populateSimpTrad(card);
    populateReadings(card);
    populateSimpTrad(card);
    // populateCharacters(card);
    // logCard("Populated card:", card);
});

console.log("Merging duplicates by reading");
{
    // See which cards are still missing an entry
    const missingChars: string[] = [];
    kanji.getChars().forEach(char => {
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

// Final population: guess empty characters

console.log("Guessing empty characters");
kanji.getChars().forEach(char => {
    const card: KanjiCard = kanji.at(char, true);
    let newCard: Partial<KanjiCard> = {};

    // First try semantic alternatives
    populateJapSemantic(card);

    // Then, guess using other fields
    const guess_empty = (charArr: FuzzyArray, newArr: FuzzyArray | undefined) => {
        if (!newArr) return;

        const chars = [card.simpChineseChar, card.tradChineseChar, card.japaneseChar]
        const others = chars.filter((a) => a != charArr);

        // Fill out empty simplified chars
        if (fuzzy_empty(charArr)) {
            const candidates = combine_without_duplicates(...others.map(a => a.v), [char]);
            newArr.v = candidates;
            newArr.guess = true;
        }
    }

    newCard.simpChineseChar = defaultFuzzyArray();
    guess_empty(card.simpChineseChar, newCard.simpChineseChar);
    newCard.tradChineseChar = defaultFuzzyArray();
    guess_empty(card.tradChineseChar, newCard.tradChineseChar);
    newCard.japaneseChar = defaultFuzzyArray();
    guess_empty(card.japaneseChar, newCard.japaneseChar);

    if (!fuzzy_empty(newCard.simpChineseChar)) card.simpChineseChar = newCard.simpChineseChar;
    if (!fuzzy_empty(newCard.tradChineseChar)) card.tradChineseChar = newCard.tradChineseChar;
    if (!fuzzy_empty(newCard.japaneseChar)) card.japaneseChar = newCard.japaneseChar;
});

// Validate results
// - All 3 character types are non-empty
// - If something is guessed, it should either be japanese only or both simp and trad chinese.
//   one of (simp, trad) as a guess should be considered invalid (just use simp for trad or vice versa)
kanji.getChars().forEach(char => {
    const card: KanjiCard = kanji.at(char, true);
    if (fuzzy_empty(card.japaneseChar) || fuzzy_empty(card.simpChineseChar) || fuzzy_empty(card.tradChineseChar)) {
        console.error("Error: Missing a field");
        logCard("", card);
        return;
    }

    const jp_g: boolean = !!card.japaneseChar.guess;
    const sp_g: boolean = !!card.simpChineseChar.guess;
    const td_g: boolean = !!card.tradChineseChar.guess;

    const mode1: boolean = !jp_g && !sp_g && !td_g;
    const mode2: boolean = !jp_g && sp_g && td_g;
    const mode3: boolean = jp_g && !sp_g && !td_g;

    if (!mode1 && !mode2 && !mode3) {
        console.error("Guess mode invalid");
        return;
    }
});

// Export results
if (args['o']) {
    console.log("Writing to file ", args['o']);
    const writeStream = fs.createWriteStream(args['o'], {
        flags: 'w', // 'a' to append
        encoding: 'utf8'
    });
    // Simulate writing many lines
    kanji.getChars().forEach(char => {
        const card = kanji.at(char);

        // tuple of key, delimiter
        const field_order: [keyof KanjiCard, string][] = [
            ['japaneseChar', ','],
            ['simpChineseChar', ','],
            ['tradChineseChar', ','],
            ['pinyin', ','],
            ['kunyomi', ','],
            ['onyomi', ','],
            ['tags', ' '],
        ];

        let fields: string[] = [];
        for (const tup of field_order) {
            const [key, delim] = tup;
            fields.push(fuzzy_join(card[key], delim));
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