import * as fs from 'fs'
import * as readline from 'readline';

import autoBind from "auto-bind";
import { log_v } from '../utils/logging';
import { isHanCharacter } from 'types';

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

    public getFrequencyRank(word: string): number {
        return this.m_entries.get(word)?.rank || 0;
    }

    public getNMostFrequentChars(n: number): string[] {
        const chars: string[] = [];
        for (let i = 0; i <= this.m_freqRankToWord.size; i++) {
            if (chars.length == n) break;
            const res = this.m_freqRankToWord.get(i);
            if (res && res.length == 1 && isHanCharacter(res.substring(0, 1))) {
                chars.push(res);
            }
        }
        return chars;
    }

    public getNMostFrequentWords(n: number): string[] {
        const words: string[] = [];
        for (let i = 0; i <= this.m_freqRankToWord.size; i++) {
            if (words.length == n) break;
            const res = this.m_freqRankToWord.get(i);
            if (res) words.push(res);
        }
        return words;
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

    private m_maxFrequency: number = 0;
    // Maps frequency rank from 1 to N to entry lemma
    private m_freqRankToWord: Map<number, string> = new Map();
    // Map lemma to entry
    private m_entries: Map<string, BccwjEntry> = new Map();
}