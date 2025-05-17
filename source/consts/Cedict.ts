import * as fs from 'fs'
import autoBind from "auto-bind";

type CedictReading = {
    pinyin: string;
    definition: string;
};

export type CedictEntry = {
    simplified: string;
    traditional: string;
    reading: CedictReading[];
};

export class Cedict {
    constructor() {
        autoBind(this);
    }
    static async create(filePath: string): Promise<Cedict> {
        const cedict = new Cedict();
        await cedict.loadData(filePath);

        return cedict;
    }
    private async loadData(filePath: string): Promise<void> {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines: string[] = content.split('\n');

        lines.forEach((line) => {
            if (line.at(0) == "#") return;

            const match = line.match(/^(.+?) (.+?) \[(.+?)\] \/(.+)\//);
            if (!match) return;
            const traditional = match[1];
            const simplified = match[2];
            const pinyin = match[3];
            const definition = match[4];

            this.emplaceEntry(traditional, simplified, { pinyin, definition });
        });
    }

    private emplaceEntry(traditional: string, simplified: string, reading: CedictReading): void {
        let id = this.m_wordToId.get(traditional);
        if (id != undefined) {
            const entry = this.m_entries.get(id);
            if (!entry) {
                console.error("No entry but found an id");
                return;
            }
            entry.reading.push(reading);
        }
        else {
            id = this.getId();
            this.m_wordToId.set(simplified, id);
            this.m_wordToId.set(traditional, id);
            this.m_entries.set(id, { simplified, traditional, reading: [reading] })
        }

        this.emplaceWord(simplified, id);
        this.emplaceWord(traditional, id);
    }

    private emplaceWord(word: string, id: number): void {
        for (const c of word) {
            const arr = this.m_charToId.get(c);
            if (!arr) this.m_charToId.set(c, [id]);
            else if (!arr.includes(id)) arr.push(id);
        }
    }

    public isChinese(word: string): boolean {
        return this.m_wordToId.has(word);
    }

    public isSimplified(word: string): boolean {
        const id = this.m_wordToId.get(word);
        if (id == undefined) return false;
        return this.m_entries.get(id)?.simplified == word;
    }

    public isTraditional(word: string): boolean {
        const id = this.m_wordToId.get(word);
        if (id == undefined) return false;
        return this.m_entries.get(id)?.traditional == word;
    }

    public getEntry(word: string): CedictEntry | undefined {
        let id = this.m_wordToId.get(word);
        if (id == undefined) return undefined;
        return this.m_entries.get(id);
    }

    public getPinyin(mychar: string): string[] | undefined {
        const entry = this.getEntry(mychar);
        if (!entry) return undefined;
        return entry.reading.map(r => r.pinyin);
    }

    public getDefinitions(mychar: string): string[] {
        const entry = this.getEntry(mychar);
        if (!entry) return [];
        return entry.reading.map(r => r.definition);
    }

    public getVocabEntriesForChar(mychar: string): CedictEntry[] {
        const ids = this.m_charToId.get(mychar) || [];
        return ids.map(e => this.m_entries.get(e)).filter(e => !!e);
    }

    private getId(): number {
        return this.m_id++;
    }

    private m_id: number = 0;
    // Vocab to id index
    private m_charToId: Map<string, number[]> = new Map();
    // Map simplified to traditional
    private m_wordToId: Map<string, number> = new Map();
    // Dictionary entries indexed by traditional chinese
    private m_entries: Map<number, CedictEntry> = new Map();
}