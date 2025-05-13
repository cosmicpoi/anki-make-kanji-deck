import autoBind from "auto-bind";
import * as xmlparser from './xmlparser';
import { XMLElement } from './xmlparser';

//----------------------------------------------------------------------------------------------------------------------
// Types
//----------------------------------------------------------------------------------------------------------------------

type KanjidicEntry = {
    character: string;
    meaning: string[];
    pinyin: string[];
    ja_kun: string[];
    ja_on: string[];
    jlpt?: number;
    freq?: number;
};

const k_ENTRY_CHAR_INVALID = '';
const defaultKanjidicEntry = (): KanjidicEntry => ({
    character: k_ENTRY_CHAR_INVALID,
    meaning: [],
    pinyin: [],
    ja_kun: [],
    ja_on: [],
});


export class Kanjidic {
    constructor() {
        autoBind(this);
    }

    static async create(filePath: string): Promise<Kanjidic> {
        const kanjidic = new Kanjidic();

        const onElement = (el: XMLElement) => {
            if (el.tagName != 'character') return;
            if (!el.children) return;

            const entry: KanjidicEntry = defaultKanjidicEntry();
            for (const child of el.children) {
                if (typeof child != 'object') continue;
                if (child.tagName == 'literal') {
                    if (child.children && typeof child.children[0] == 'string') {
                        entry.character = child.children[0];
                    }
                }
                else if (child.tagName == 'misc') {
                    if (!child.children) continue;
                    for (const subchild of child.children) {
                        if (typeof subchild != 'object') continue;
                        if (subchild.tagName == 'jlpt' && subchild.children && typeof subchild.children[0] == 'string') {
                            entry.jlpt = parseInt(subchild.children[0]);
                        }
                        else if (subchild.tagName == 'freq' && subchild.children && typeof subchild.children[0] == 'string') {
                            entry.freq = parseInt(subchild.children[0]);
                        }
                    }
                }
                else if (child.tagName == 'reading_meaning') {
                    if (!child.children) continue;
                    for (const schild of child.children) {
                        if (typeof schild != 'object' || schild.tagName != 'rmgroup') continue;
                        if (!schild.children) continue;
                        for (const subchild of schild.children) {
                            if (typeof subchild != 'object') continue;
                            if (subchild.tagName == 'meaning' && subchild.children && typeof subchild.children[0] == 'string') {
                                if (subchild.attributes?.['m_lang'] == undefined) {
                                    entry.meaning.push(subchild.children[0]);
                                }
                            }
                            else if (subchild.tagName == 'reading' && subchild.children && typeof subchild.children[0] == 'string') {
                                if (subchild.attributes?.['r_type'] == "pinyin") {
                                    entry.pinyin.push(subchild.children[0]);
                                }
                                else if (subchild.attributes?.['r_type'] == "ja_on") {
                                    entry.ja_on.push(subchild.children[0]);
                                }
                                else if (subchild.attributes?.['r_type'] == "ja_kun") {
                                    entry.ja_kun.push(subchild.children[0]);
                                }
                            }
                        }
                    }
                }

            }

            if (entry.character != k_ENTRY_CHAR_INVALID) {
                kanjidic.emplaceEntry(entry);
            }
        }

        const handlers = {
            skipRoot: false,
            onElement,
        };
        await xmlparser.parseXML(filePath, handlers)
        return kanjidic;
    }



    public getChars(): string[] {
        return [...this.m_entries.keys()];
    }

    public isKanji(mychar: string): boolean {
        return this.m_entries.has(mychar);
    }

    public getEntry(mychar: string): KanjidicEntry | undefined {
        return this.m_entries.get(mychar);
    }

    public getMeaning(mychar: string): string[] {
        return this.m_entries.get(mychar)?.meaning || [];
    }

    private emplaceEntry(entry: KanjidicEntry): void {
        this.m_entries.set(entry.character, entry);
    }

    private m_entries: Map<string, KanjidicEntry> = new Map();
}