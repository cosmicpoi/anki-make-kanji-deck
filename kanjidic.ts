import * as fs from 'fs'
import autoBind from "auto-bind";
import { k_KANJIDIC_FILE_PATH } from "./consts";
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

const k_READING_ATTRS = {
    pinyin: "pinyin",
    korean_r: "korean_r",
    korean_h: "korean_h",
    vietnam: "vietnam",
    ja_on: "ja_on",
    ja_kun: "ja_kun",
};

type KanjidicEntry = {
    character: string;
    meaning: string[];
    pinyin: string[];
    ja_kun: string[];
    ja_on: string[];
};

export class Kanjidic {
    constructor() {
        autoBind(this);
        this.loadData(k_KANJIDIC_FILE_PATH);
    }
    private loadData(filePath: string): void {
        const content = fs.readFileSync(filePath, 'utf-8');
        const res = xml_convert.xml2js(content);
        const elements = res.elements[res.elements.length - 1].elements;
        elements.forEach((el: XMLElement) => {
            // if (el.type = 'element' || el.name != 'character') return;
            if (!(el.type == 'element' && el.name == 'character')) return;
            let literal: string | undefined = undefined;
            let pinyin: string[] = [];
            let ja_kun: string[] = [];
            let ja_on: string[] = [];
            let meaning: string[] = [];
            el.elements.forEach(subel => {
                if (subel.name == 'literal') {
                    literal = subel.elements[0].text;
                }
                if (subel.name == 'reading_meaning') {
                    subel.elements[0].elements.forEach((subsubel) => {
                        if (subsubel.type != 'element') return;
                        
                        const name = subsubel.name;
                        if (!['reading', 'meaning'].includes(name)) return;

                        const r_type = subsubel.attributes?.r_type;
                        const m_lang = subsubel.attributes?.m_lang;
                        const text: string | undefined = subsubel.elements[0].text;;

                        // console.log(name, r_type, text);

                        if (name == 'reading') {
                            if (r_type == k_READING_ATTRS.pinyin) {
                                if (text) pinyin = [...pinyin, ...text.split(' ')];
                            }
                            else if (r_type == k_READING_ATTRS.ja_kun) {
                                if (text) ja_kun = [...ja_kun, ...text.split(' ')];
                            }
                            else if (r_type == k_READING_ATTRS.ja_on) {
                                if (text) ja_on = [...ja_on, ...text.split(' ')];
                            }
                        }
                        else if (name == 'meaning') {
                            if (m_lang) return;
                            if (text) meaning.push(text);
                        }
                    });
                }
            })

            if (!literal) return;

            this.m_entries.set(literal, { character: literal, pinyin, ja_kun, ja_on, meaning });
        });
    }

    public isKanji(mychar: string): boolean {
        return this.m_entries.has(mychar);
    }

    public getEntry(mychar: string): KanjidicEntry | undefined {
        return this.m_entries.get(mychar);
    }

    private m_entries: Map<string, KanjidicEntry> = new Map();
}