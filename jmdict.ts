import autoBind from "auto-bind";
import * as xmlparser from './xmlparser';
import { ParamXMLElement, XMLDtdDecl, XMLParserProps } from "./xmlparser";

//----------------------------------------------------------------------------------------------------------------------
// Types
//----------------------------------------------------------------------------------------------------------------------

// Dictionary types 

// `entSeq` entry sequence - unique numeric id
// `kanjiElement` - kanji rendering
// `readingElement` - kana reading
// `sense` - translations

// The kanji element, or in its absence, the reading element, is
//         the defining component of each entry.
//         The overwhelming majority of entries will have a single kanji
//         element associated with a word in Japanese. Where there are
//         multiple kanji elements within an entry, they will be orthographical
//         variants of the same word, either using variations in okurigana, or
//         alternative and equivalent kanji.
type JmdictSense = {
    pos: string[]; // pos
    xref: string[]; // cross-reference
    gloss: string[];
    misc: string[];
    s_inf: string[];
};
type JmdictKele = {
    keb: string;
    ke_pri: string[];
}
type JmdictRele = {
    reb: string;
    re_pri: string[];
}

export type JmdictEntry = {
    ent_seq: number; // ent_seq
    k_ele: JmdictKele[]; // k_ele
    r_ele: JmdictRele[]; // r_ele
    sense: JmdictSense[]; // sense
};

const makeDefaultSense = (): JmdictSense =>
    ({ pos: [], xref: [], gloss: [], misc: [], s_inf: [] });

const k_KEB_INVALID = '';
const makeDefaultKele = (): JmdictKele =>
    ({ keb: k_KEB_INVALID, ke_pri: [] });

const k_REB_INVALID = '';
const makeDefaultRele = (): JmdictRele =>
    ({ reb: k_REB_INVALID, re_pri: [] });

const k_ENT_SEQ_INVALID = -1;
const makeDefaultEntry = (): JmdictEntry => ({
    ent_seq: k_ENT_SEQ_INVALID,
    k_ele: [],
    r_ele: [],
    sense: [],
});

// XML Schema

type JmdictAttrKey = {
    'xml:lang': 'xml:lang';
};

type JmdictTagType = {
    r_ele: 'r_ele';
    k_ele: 'k_ele';
    ke_pri: 'ke_pri';
    re_pri: 're_pri';
    sense: 'sense';
    entry: 'entry';
    ent_seq: 'ent_seq';
    keb: 'keb';
    reb: 'reb';
    pos: 'pos';
    gloss: 'gloss';
    xref: 'xref';
    misc: 'misc';
    s_inf: 's_inf';
};

type JmdictElement = ParamXMLElement<keyof JmdictTagType, keyof JmdictAttrKey>;

type JME_EntSeq = JmdictElement & {
    tagName: 'ent_seq'
    children: [string];
};
type JME_Keb = JmdictElement & {
    tagName: 'keb',
    children: [string];
};
type JME_Kepri = JmdictElement & {
    tagName: 'ke_pri'
    children: [string];
};
type JME_Kele = JmdictElement & {
    tagName: 'k_ele',
    children: (JME_Keb | JME_Kepri)[]
};
type JME_Reb = JmdictElement & {
    tagName: 'reb',
    children: [string];
};
type JME_Repri = JmdictElement & {
    tagName: 're_pri'
    children: [string];
};
type JME_Rele = JmdictElement & {
    tagName: 'r_ele',
    children: (JME_Reb | JME_Repri)[]
};
type JME_Gloss = JmdictElement & {
    tagName: 'gloss',
    children: [string]
};
type JME_Pos = JmdictElement & {
    tagName: 'pos',
    children: [string]
};
type JME_Misc = JmdictElement & {
    tagName: 'misc',
    children: [string]
};
type JME_Xref = JmdictElement & {
    tagName: 'xref',
    children: [string]
};
type JME_Sinf = JmdictElement & {
    tagName: 's_inf',
    children: [string]
};
type JME_Sense = JmdictElement & {
    tagName: 'sense',
    children: (JME_Gloss | JME_Misc | JME_Pos | JME_Xref | JME_Misc | JME_Sinf)[]
};
type JME_Entry = JmdictElement & {
    tagName: 'entry',
    children: (JME_EntSeq | JME_Kele | JME_Rele | JME_Sense)[],
};

//----------------------------------------------------------------------------------------------------------------------
// Helper functions
//----------------------------------------------------------------------------------------------------------------------

const k_SCORE_1 = 1;
const k_SCORE_2 = 1 / 5;
const k_SCORE_NF_DEN = 50;

const getScore = (pris: string[]): number => {
    let score = 0;
    for (const pri of pris) {
        if (pri.match(/^nf\d\d$/)) {
            const xx = parseInt(pri.slice(-2, 0));
            score += xx / k_SCORE_NF_DEN;
        }
        else if (pri.slice(-1) == '1') {
            score += k_SCORE_1;
        }
        else if (pri.slice(-1) == '2') {
            score += k_SCORE_2;
        }
    }

    return score;
}

export function getPreferredKele(entry: JmdictEntry): [string | undefined, number] {
    if (entry.k_ele.length == 0) return [undefined, -1]

    let preferred: string | undefined = undefined;
    let highestScore = 0; // score is # of pri1 + # of pri2 / 5
    for (const k_ele of entry.k_ele) {
        const score = getScore(k_ele.ke_pri);
        if (score > highestScore) {
            preferred = k_ele.keb;
            highestScore = score;
        }
    }

    if (preferred == undefined) {
        return [entry.k_ele[0].keb, 0];
    }
    else {
        return [preferred, highestScore]
    };
}

export function getPreferredRele(entry: JmdictEntry): [string | undefined, number] {
    if (entry.r_ele.length == 0) return [undefined, -1];

    let preferred: string | undefined = undefined;
    let highestScore = 0; // score is # of pri1 + # of pri2 / 5

    for (const r_ele of entry.r_ele) {
        const score = getScore(r_ele.re_pri);
        if (score > highestScore) {
            preferred = r_ele.reb;
            highestScore = score;
        }
    }

    if (preferred == undefined) {
        return [entry.r_ele[0].reb, 0];
    }
    else {
        return [preferred, highestScore]
    };
}

// Scoring system:
// - 1 point for each xx1 tag
// - 1 / n+1 point for each xx2 tag (where n is number of possible tags)
// - xx / 50 points for each nfxx tag (since they go up to 50)
export function getPreferredReading(entry: JmdictEntry): [string, number] {
    const [prefK, scoreK] = getPreferredKele(entry);
    const [prefR, scoreR] = getPreferredRele(entry);

    if ((scoreK > scoreR) && prefK) {
        return [prefK, scoreK];
    } else if ((scoreK < scoreR) && prefR) {
        return [prefR, scoreR];
    }
    else {
        if (prefK) return [prefK, scoreK];
        return [prefR as string, scoreR];
    }
}

//----------------------------------------------------------------------------------------------------------------------
// Jmdict Implementation
//----------------------------------------------------------------------------------------------------------------------

export class Jmdict {
    constructor() {
        autoBind(this);
    }
    static async create(filePath: string): Promise<Jmdict> {
        const jmdict = new Jmdict();


        const serializeKele = (el: JME_Kele): JmdictKele => {
            const kele = makeDefaultKele();
            for (const child of el.children) {
                if (child.tagName == 'keb') kele.keb = child.children[0];
                else if (child.tagName == 'ke_pri') kele.ke_pri.push(child.children[0]);
            }
            return kele;
        };
        const serializeRele = (el: JME_Rele): JmdictRele => {
            const rele = makeDefaultRele();
            for (const child of el.children) {
                if (child.tagName == 'reb') rele.reb = child.children[0];
                else if (child.tagName == 're_pri') rele.re_pri.push(child.children[0]);
            }
            return rele;
        };
        const serializeSense = (el: JME_Sense): JmdictSense => {
            const sense = makeDefaultSense();
            for (const child of el.children) {
                if (child.tagName == 'pos') sense.pos.push(child.children[0]);
                else if (child.tagName == 'gloss') sense.gloss.push(child.children[0]);
                else if (child.tagName == 'xref') sense.xref.push(child.children[0]);
                else if (child.tagName == 'misc') sense.misc.push(child.children[0]);
                else if (child.tagName == 's_inf') sense.s_inf.push(child.children[0]);
            }
            return sense;
        }
        const serializeEntry = (el: JME_Entry): JmdictEntry => {
            const entry: JmdictEntry = makeDefaultEntry();

            for (const child of el.children) {
                if (child.tagName == 'ent_seq') {
                    entry.ent_seq = parseInt(child.children[0]);
                }
                else if (child.tagName == 'k_ele') {
                    entry.k_ele.push(serializeKele(child));
                }
                else if (child.tagName == 'r_ele') {
                    entry.r_ele.push(serializeRele(child));
                }
                else if (child.tagName == 'sense') {
                    entry.sense.push(serializeSense(child));
                }
            }
            return entry;
        };

        const onElement = (el: JmdictElement) => {
            if (el.tagName == 'entry') {
                const entry: JmdictEntry = serializeEntry(el as JME_Entry)
                // console.dir(entry, { depth: null, colors: true });
                jmdict.emplaceEntry(entry);
            }
        };

        const onDtd = (e: XMLDtdDecl) => {
            if (e.tagName == '!ENTITY') {
                jmdict.emplaceEntity(e.key, e.value);
            }
        }

        const handlers: XMLParserProps<keyof JmdictTagType, keyof JmdictAttrKey> = {
            skipRoot: false,
            onDtdDecl: onDtd,
            onElement: onElement,
        };

        await xmlparser.parseXML<keyof JmdictTagType, keyof JmdictAttrKey>(filePath, handlers);
        return jmdict;
    }

    public forEachWord(handler: (word: string) => void) {
        for (const tup of this.m_wordToSeq) {
            const [key] = tup;
            handler(key);
        }
    }

    public getWords(): Iterable<string> {
        return this.m_wordToSeq.keys();
    }

    public forEachSeq(handler: (seq: number) => void) {
        for (const tup of this.m_entries) {
            const [seq] = tup;
            handler(seq);
        }
    }

    public getSeq(): Iterable<number> {
        return this.m_entries.keys();
    }

    public forEachEntry(handler: (entry: JmdictEntry) => void) {
        for (const tup of this.m_entries) {
            const [_seq, entry] = tup;
            handler(entry);
        }
    }

    public getEntries(): Iterable<JmdictEntry> {
        return this.m_entries.values();
    }

    public getNumEntries(): number {
        return this.m_entries.size;
    }

    private emplaceEntity(key: string, value: string): void {
        this.m_entityAbbrev[key] = value;
    }

    private emplaceEntry(entry: JmdictEntry): void {
        if (entry.ent_seq == k_ENT_SEQ_INVALID) {
            console.error("invalid");
            return;
        }
        if (this.m_entries.has(entry.ent_seq)) {
            console.error("Entry already exists", entry.ent_seq);
            return;
        }
        this.m_entries.set(entry.ent_seq, entry);

        entry.k_ele.forEach(({ keb }) => {
            // this.m_kEleToSeq.set(keb, entry.ent_seq);
            this.m_wordToSeq.set(keb, entry.ent_seq);
        })
        entry.r_ele.forEach(({ reb }) => {
            // this.m_rEleToSeq.set(reb, entry.ent_seq);
            this.m_wordToSeq.set(reb, entry.ent_seq);
        })

    }

    public getEntryByWord(text: string): JmdictEntry | undefined {
        const seq = this.m_wordToSeq.get(text);
        if (seq == undefined) return undefined;
        return this.m_entries.get(seq);
    }

    public getEntryBySeq(seq: number): JmdictEntry | undefined {
        return this.m_entries.get(seq);
    }

    

    public getAbbrevs(): Readonly<Record<string, string>> {
        return this.m_entityAbbrev;
    };
    // Entity abbreviations
    private m_entityAbbrev: Record<string, string> = {};

    // Index of k_ele to ent seq
    private m_kEleToSeq: Map<string, number> = new Map();
    // Index of r_ele to ent seq
    private m_rEleToSeq: Map<string, number> = new Map();
    // Index of word to ent seq
    private m_wordToSeq: Map<string, number> = new Map();
    // Dictionary entries indexed by entry seq
    private m_entries: Map<number, JmdictEntry> = new Map();
}