import * as fs from 'fs'
import autoBind from "auto-bind";



type JmdictEntry = {
    
};

export class Jmdict {
    constructor(filePath: string) {
        autoBind(this);
        this.m_loadData(filePath);
    }
    private m_loadData(filePath: string): void {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines: string[] = content.split('\n');

    }

    

    // Dictionary entries indexed by traditional chinese
    private m_entries: Map<string, JmdictEntry> = new Map();
}