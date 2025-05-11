import * as fs from 'fs'
import autoBind from "auto-bind";
import * as xml_convert from 'xml-js'

type XMLName = 'reading_meaning' | 'character' | 'literal' | 'reading' | 'meaning';
type XMLAttributeObj = Partial<{
    m_lang: string;
    r_type: string;
}>;

type XMLElement = {
    type: 'comment' | 'text' | 'element';
    name: XMLName;
    elements: XMLElement[];
    attributes?: XMLAttributeObj;
    text?: string;
};

type JmdictEntry = {
    
};

export class Jmdict {
    constructor(filePath: string) {
        autoBind(this);
        this.m_loadData(filePath);
    }
    private m_loadData(filePath: string): void {
        const content = fs.readFileSync(filePath, 'utf-8');
        const res = xml_convert.xml2js(content);
        console.log(res);

    }

    

    // Dictionary entries indexed by traditional chinese
    private m_entries: Map<string, JmdictEntry> = new Map();
}