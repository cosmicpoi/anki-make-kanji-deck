import * as fs from 'fs'
import autoBind from "auto-bind";

type CedictReading = {
    pinyin: string;
    definition: string;
};

type CedictEntry = {
    simplified: string;
    traditional: string;
    reading: CedictReading[];
};

export class Cedict {
    constructor(filePath: string) {
        autoBind(this);
        this.m_loadData(filePath);
    }
    private m_loadData(filePath: string): void {
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

            this.m_emplaceEntry(traditional, simplified, { pinyin, definition });
        });
    }

    private m_emplaceEntry(traditional: string, simplified: string, reading: CedictReading): void {
        if (!this.m_simpToTrad.has(simplified)) {
            this.m_simpToTrad.set(simplified, traditional);
        }

        if (!this.m_entries.has(traditional)) {
            this.m_entries.set(traditional, { simplified, traditional, reading: [reading] });
        }
        else {
            const res = this.m_entries.get(traditional);
            if (!res) return;
            res.reading.push(reading);
        }
    }

    public isChinese(mychar: string): boolean {
        return this.m_simpToTrad.has(mychar) || this.m_entries.has(mychar);
    }

    public isSimplified(mychar: string): boolean {
        return this.m_simpToTrad.has(mychar)
    }

    public isTraditional(mychar: string): boolean {
        return this.m_entries.has(mychar)
    }

    public getEntry(mychar: string): CedictEntry | undefined {
        let res = this.m_entries.get(mychar);

        if (res) return res;

        const tradChar = this.m_simpToTrad.get(mychar);
        if (!tradChar) return undefined;
        return this.m_entries.get(tradChar);
    }

    public getPinyin(mychar: string): string[] | undefined {
        const entry = this.getEntry(mychar);
        if (!entry) return undefined;
        return entry.reading.map(r => r.pinyin);
    }

    public getDefinitions(mychar: string): string[] | undefined {
        const entry = this.getEntry(mychar);
        if (!entry) return undefined;
        return entry.reading.map(r => r.definition);
    }

    // Map simplified to traditional
    private m_simpToTrad: Map<string, string> = new Map();
    // Dictionary entries indexed by traditional chinese
    private m_entries: Map<string, CedictEntry> = new Map();
}