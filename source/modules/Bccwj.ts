import * as fs from 'fs'
import * as readline from 'readline';

import autoBind from "auto-bind";
import { log_v } from '../../logging';

enum BccwjWordType {
    Kai = '外',  // Foreign Loanwords
    Wa = '和',   // Native Japanese
    Kan = '漢',  // Sino-Japanese words
    Ko = '固',   // Proper nouns
};

export type BccwjEntry = {
    rank: number;
    lForm: string;
    lemma: string;
    // pos: string;
    wType: BccwjWordType;
    frequency: number;
};



export class Bccwj {
    constructor() {
        autoBind(this);
    }

    static async create(filePath: string, props?: { maxLines?: number, verbose?: boolean }): Promise<Bccwj> {
        log_v(!!props?.verbose, "Initializing bccwj");

        const bccwj = new Bccwj();
        // Create filestream
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity, // Recognize all instances of CR LF ('\r\n') as a single line break
        });


        let count = 0;
        let _fields: string[] | undefined = undefined;

        for await (const line of rl) {
            const vals = line.split('\t');
            if (!_fields) {
                _fields = vals;
                continue;
            }
            // fields
            const entry: BccwjEntry = {
                rank: parseInt(vals[0]),
                lForm: vals[1],
                lemma: vals[2],
                // pos: vals[3],
                wType: vals[5] as BccwjWordType,
                frequency: parseInt(vals[6]),
            };
            bccwj.emplaceEntry(count, entry);

            count++;
            if (props?.maxLines) {
                if (count >= props.maxLines) break;
            }
        }


        return bccwj;
    }

    public getEntry(word: string): BccwjEntry | undefined {
        return this.m_entries.get(word);
    }

    public getFrequency(word: string): number {
        return this.m_entries.get(word)?.frequency || 0;
    }

    public forEachEntry(handler: (entry: BccwjEntry) => void): void {
        this.m_entries.forEach(handler);
    }

    private emplaceEntry(rank: number, entry: BccwjEntry): void {
        this.m_entries.set(entry.lemma, entry);
        this.m_freqRankToWord.set(rank, entry.lemma);

        if (entry.frequency > this.m_maxFrequency) {
            this.m_maxFrequency = entry.frequency;
        }
    }

    public getMaxFrequency(): number {
        return this.m_maxFrequency;
    }

    // Map lemma to entry
    private m_maxFrequency: number = 0;
    private m_freqRankToWord: Map<number, string> = new Map();
    private m_entries: Map<string, BccwjEntry> = new Map();
}