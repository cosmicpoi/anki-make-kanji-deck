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
    grade?: number;
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

        let i = 0;
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
                        else if (subchild.tagName == 'grade' && subchild.children && typeof subchild.children[0] == 'string') {
                            entry.grade = parseInt(subchild.children[0]);
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
                kanjidic.emplaceEntry(i, entry);
                i++;
            }
        }

        const handlers = {
            skipRoot: false,
            onElement,
        };
        await xmlparser.parseXML(filePath, handlers)
        return kanjidic;
    }

    // Getters
    public getChars(): string[] {
        return [...this.m_entries.keys()];
    }

    public getJLPTChars(): string[] {
        const values: string[][] = [...this.m_jlptToChar.values()];
        return values.reduce((a1, a2) => [...a1, ...a2]);
    }

    public getNMostFrequent(n: number): string[] {
        if (n > this.m_entries.size) {
            console.error("N too large");
            return [];
        }
        return Array(n).fill(0)
            .map((_, i) => this.m_freqRankToChar.get(i) || '')
            .filter(s => s != '');
    }

    public getEntry(mychar: string): KanjidicEntry | undefined {
        return this.m_entries.get(mychar);
    }

    public getMeaning(mychar: string): string[] {
        return this.m_entries.get(mychar)?.meaning || [];
    }

    // Set logic
    private emplaceEntry(rank: number, entry: KanjidicEntry): void {
        this.m_entries.set(entry.character, entry);
        this.m_freqRankToChar.set(rank, entry.character);

        if (entry?.jlpt != undefined) {
            const res = this.m_jlptToChar.get(entry.jlpt);
            if (!res) this.m_jlptToChar.set(entry.jlpt, [entry.character]);
            else res.push(entry.character);
        }

        if (entry?.grade != undefined) {
            const res = this.m_gradeToChar.get(entry.grade);
            if (!res) this.m_gradeToChar.set(entry.grade, [entry.character]);
            else res.push(entry.character);
        }
    }

    // Fields
    private m_freqRankToChar: Map<number, string> = new Map();
    private m_gradeToChar: Map<number, string[]> = new Map();
    private m_jlptToChar: Map<number, string[]> = new Map();
    private m_entries: Map<string, KanjidicEntry> = new Map();
}