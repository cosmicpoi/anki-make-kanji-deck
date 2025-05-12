import * as fs from 'fs'
import autoBind from "auto-bind";
import { CharacterType, concatKanjiCards, fuzzy_join, fuzzy_to_string, get_default_kanji_card, KanjiCard, try_emplace_fuzzy } from "./types";
import { k_note_CN_JP, k_tag_CHINESE_ONLY, k_note_CHINESE_ONLY, k_tag_JAPANESE_ONLY, k_note_JAPANESE_ONLY } from './consts';

// Represents character 'master list' that we build up through the db info we have.

export class KanjiMap {
    constructor() {
        autoBind(this);
        this.kanji = {};
    }

    // Get a list of all currently map keys
    public getChars(): string[] {
        return Object.keys(this.kanji);
    }

    public forEachCard(handler: (c: KanjiCard) => void) {
        for (const char in this.kanji) {
            handler(this.kanji[char]);
        }
    }

    public getCards(): KanjiCard[] {
        return Object.values(this.kanji);
    }

    // Save to file
    public toFile(output: string): void {
        type CleanCard = Partial<{ [k in keyof KanjiCard]: string }>;
        let cleanMap: { [k: string]: CleanCard } = {};
        this.getChars().forEach((mychar: string) => {
            const card = this.kanji[mychar];
            let cleanCard: CleanCard = {};

            let key: keyof KanjiCard;
            for (key in card) {
                if (key != 'tags') {
                    cleanCard[key] = fuzzy_to_string(card[key]);
                }
                else {
                    cleanCard[key] = JSON.stringify(card[key]);
                }
            }

            cleanMap[mychar] = cleanCard;
        });

        fs.writeFile(output, JSON.stringify(cleanMap), (err) => {
            if (err) {
                console.error('Error writing file:', err);
            } else {
                console.log('JSON written to ', output);
            }
        });
    }


    // Merge two entries
    public merge(c1: string, c2: string, { warn = true, skipDoubles = true }): void {
        if (!this.has(c1) || !this.has(c2)) {
            if (warn)
                console.error("Could not find an entry for merge ", c1, c2);
            return;
        }
        const card1: KanjiCard = this.at(c1, true);
        const card2: KanjiCard = this.at(c2, true);
        const newCard: KanjiCard = concatKanjiCards(card1, card2)

        if (skipDoubles) {
            if (newCard.japaneseChar.v.length > 1
                || newCard.simpChineseChar.v.length > 1
                || newCard.tradChineseChar.v.length > 1) {
                return;
            }
        }

        const ord = [c1, c2];
        ord.sort();
        const newKey = ord[0];

        this.delete(c1);
        this.delete(c2);
        this.ratify(newKey);
        this.kanji[newKey] = newCard;
    }

    // See if an entry exists
    public has(mychar: string) {
        return this.kanji[mychar] != undefined;
    }

    // Ensure an entry exists for the given value
    public ratify(mychar: string) {
        if (this.kanji[mychar] == undefined) {
            this.kanji[mychar] = get_default_kanji_card();
        }
    }

    // Get the entry corresponding to a specific character.
    // If `readonly` is false, create a default value in-place if one does not exist.
    public at(mychar: string, readonly = false): KanjiCard {
        if (!readonly) this.ratify(mychar);

        return this.kanji[mychar];
    }

    // Delete the given entry. Assumes it exists
    public delete(mychar: string): void {
        if (!this.has(mychar)) {
            console.error("Entry does not exist");
        }
        delete this.kanji[mychar];
    }

    // Try to emplace `tag` into the entry for `mychar`.
    // Assumes an entry exists already.
    public emplace_tags(mychar: string, tags: string[] | undefined): void {
        const card: KanjiCard = this.at(mychar, false);
        if (tags == undefined) return;

        tags.forEach(tag => {
            if (!card.tags.v.includes(mychar)) {
                card.tags.v.push(tag);
            }
        })
    }

    // Try to emplace `character` into the corresponding entry for `type`
    // If no entry exists, create it first
    public emplace_character(mychar: string, type: CharacterType): void {
        const card: KanjiCard = this.at(mychar);
        if (type == CharacterType.Japanese) {
            try_emplace_fuzzy(card.japaneseChar, mychar);
        }
        else if (type == CharacterType.SimplifiedChinese) {
            try_emplace_fuzzy(card.simpChineseChar, mychar);
        }
        else if (type == CharacterType.TraditionalChinese) {
            try_emplace_fuzzy(card.tradChineseChar, mychar);
        }
    }

    public writeToFile(filePath: string) {
        console.log("Writing to file ", filePath);
        const writeStream = fs.createWriteStream(filePath, {
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

        // let keys: string[] = [];
        // const jjp = kanji.getCards().filter(c => c.tags.v.includes(k_tag_JAPANESE_ONLY));
        // const ccn = kanji.getCards().filter(c => c.tags.v.includes(k_tag_CHINESE_ONLY));
        // keys = [jjp[0].japaneseChar.v[0], ccn[0].simpChineseChar.v[0], '中'];
        // console.log(keys);

        const keys = this.getChars();
        keys.sort();
        const to_export = keys.map(c => this.at(c));
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

    // It would be nice to index these specifically by jp/trad/simp etc, but there's no guarantee
    // every char has all variants so we just tiebreak on sort order. 
    private kanji: { [k: string]: KanjiCard };
}