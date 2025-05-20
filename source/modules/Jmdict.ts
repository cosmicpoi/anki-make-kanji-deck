import autoBind from "auto-bind";
import * as xmlparser from '../xmlparser';
import { ParamXMLElement, XMLDtdDecl, XMLParserProps } from "../xmlparser";
import { isHanCharacter } from "../types";

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
export type JmdictSense = {
    pos: string[]; // pos
    xref: string[]; // cross-reference
    gloss: JmdictGloss[];
    misc: string[];
    s_inf: string[];
};
type JmdictKele = {
    keb: string;
    ke_pri: string[];
    ke_inf: string[];
}
type JmdictRele = {
    reb: string;
    re_pri: string[];
    re_inf: string[];
}
type JmdictGloss = {
    lang: JmdictGlossLang;
    text: string;
};

export type JmdictEntry = {
    ent_seq: number; // ent_seq
    k_ele: JmdictKele[]; // k_ele
    r_ele: JmdictRele[]; // r_ele
    sense: JmdictSense[]; // sense

    cachedPreferredReading: string;
    cachedPreferredRele: string;
    cachedPreferredKele: string;
};

const makeDefaultSense = (): JmdictSense =>
    ({ pos: [], xref: [], gloss: [], misc: [], s_inf: [] });

const makeDefaultGloss = (): JmdictGloss =>
    ({ lang: JmdictGlossLang.eng, text: '' });

const k_KEB_INVALID = '';
const makeDefaultKele = (): JmdictKele =>
    ({ keb: k_KEB_INVALID, ke_pri: [], ke_inf: [] });

const k_REB_INVALID = '';
const makeDefaultRele = (): JmdictRele =>
    ({ reb: k_REB_INVALID, re_pri: [], re_inf: [] });

const k_ENT_SEQ_INVALID = -1;
const makeDefaultEntry = (): JmdictEntry => ({
    ent_seq: k_ENT_SEQ_INVALID,
    k_ele: [],
    r_ele: [],
    sense: [],
    cachedPreferredReading: '',
    cachedPreferredRele: '',
    cachedPreferredKele: '',
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
    ke_inf: 'ke_inf';
    re_inf: 're_inf';
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

export enum JmdictAbbrevs {
    // kanji info entities
    phonetic = "&ateji;", // "ateji (phonetic) reading">
    irregular_kana = "&ik;",    //"word containing irregular kana usage">
    irregular_kanji = "&iK;",    //"word containing irregular kanji usage">
    irregular_okurigana = "&io;",    //"irregular okurigana usage">
    outdated_kanji = "&oK;",    //"word containing out-dated kanji or kanji usage">
    rarely_kanji = "&rK;",    //"rarely used kanji form">
    search_kanji = "&sK;",    //"search-only kanji form">
    // misc entities
    usually_kana = "&uk;", // usually kana
    humble = "&hum;", // kenjougo
    honorific = "&hon;", // sonkeigo
    net_sl = "&net-sl;", // net slang
    vulgar = "&vulg;", // vulgar
    slang = "&sl;", // slang
    manga_slang = "&m-sl;", // manga slang
    obselete = "&obs;", // obselete
    archaic = "&arch;", // archaic
};

export enum JmdictGlossLang {
    eng = "eng",
}

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
type JME_Keinf = JmdictElement & {
    tagName: 'ke_inf';
    children: [string];
}
type JME_Kele = JmdictElement & {
    tagName: 'k_ele',
    children: (JME_Keb | JME_Kepri | JME_Keinf)[]
};
type JME_Reb = JmdictElement & {
    tagName: 'reb',
    children: [string];
};
type JME_Repri = JmdictElement & {
    tagName: 're_pri'
    children: [string];
};
type JME_Reinf = JmdictElement & {
    tagName: 're_inf';
    children: [string];
}
type JME_Rele = JmdictElement & {
    tagName: 'r_ele',
    children: (JME_Reb | JME_Repri | JME_Reinf)[]
};
type JME_Gloss = JmdictElement & {
    tagName: 'gloss',
    attributes: {
        'xml:lang': JmdictGlossLang,
    }
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

export function isUsuallyKana(entry: JmdictEntry): boolean {
    const sense = getPreferredSense(entry);
    return sense.misc.some(misc => misc == JmdictAbbrevs.usually_kana);
}

export function getPreferredSense(entry: JmdictEntry): JmdictSense {
    const senses = entry.sense.filter(s => !(isSlang(s) || isObselete(s) || isArchaic(s)));
    if (senses.length > 0) {
        return senses[0];
    }
    return entry.sense[0];
}

export function isSlang(sense: JmdictSense): boolean {
    return sense.misc.some(misc => misc == JmdictAbbrevs.slang
        || misc == JmdictAbbrevs.manga_slang
        || misc == JmdictAbbrevs.net_sl
    );
}

export function isObselete(sense: JmdictSense): boolean {
    return sense.misc.some(misc => misc == JmdictAbbrevs.obselete);
}

export function isVulgar(sense: JmdictSense): boolean {
    return sense.misc.some(misc => misc == JmdictAbbrevs.vulgar);
}

export function isArchaic(sense: JmdictSense): boolean {
    return sense.misc.some(misc => misc == JmdictAbbrevs.archaic);
}

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

function getPreferredKeleWithScore(entry: JmdictEntry): [string | undefined, number] {
    if (entry.k_ele.length == 0) return [undefined, -1]
    let kele = entry.k_ele.filter(k =>
        !k.ke_inf.includes(JmdictAbbrevs.irregular_kanji) &&
        !k.ke_inf.includes(JmdictAbbrevs.irregular_okurigana) &&
        !k.ke_inf.includes(JmdictAbbrevs.rarely_kanji) &&
        !k.ke_inf.includes(JmdictAbbrevs.outdated_kanji) &&
        !k.ke_inf.includes(JmdictAbbrevs.search_kanji)
    );
    if (kele.length == 0) kele = entry.k_ele;

    let preferred: string | undefined = undefined;
    let highestScore = 0; // score is # of pri1 + # of pri2 / 5
    for (const k_ele of kele) {
        const score = getScore(k_ele.ke_pri);
        if (score > highestScore) {
            preferred = k_ele.keb;
            highestScore = score;
        }
    }

    if (preferred == undefined) {
        return [kele[0].keb, 0];
    }
    else {
        return [preferred, highestScore]
    };
}

export function getPreferredKele(entry: JmdictEntry): string {
    if (entry.cachedPreferredKele != '') {
        return entry.cachedPreferredKele;
    }
    const [val] = getPreferredKeleWithScore(entry);
    entry.cachedPreferredKele = val || '';
    return val || '';
}

function getPreferredReleWithScore(entry: JmdictEntry): [string | undefined, number] {
    if (entry.r_ele.length == 0) return [undefined, -1];
    let rele = entry.r_ele.filter(r =>
        !r.re_inf.includes(JmdictAbbrevs.irregular_kana)
    );
    if (rele.length == 0) rele = entry.r_ele;

    let preferred: string | undefined = undefined;
    let highestScore = 0; // score is # of pri1 + # of pri2 / 5

    for (const r_ele of rele) {
        const score = getScore(r_ele.re_pri);
        if (score > highestScore) {
            preferred = r_ele.reb;
            highestScore = score;
        }
    }

    if (preferred == undefined) {
        return [rele[0].reb, 0];
    }
    else {
        return [preferred, highestScore]
    };
}

export function getPreferredRele(entry: JmdictEntry): string {
    if (entry.cachedPreferredRele != '') {
        return entry.cachedPreferredRele;
    }
    const [val] = getPreferredReleWithScore(entry);
    entry.cachedPreferredRele = val || '';
    return val || '';
}

// export function getPreferredReading(entry: JmdictEntry): string {

// }

// Scoring system:
// - 1 point for each xx1 tag
// - 1 / n+1 point for each xx2 tag (where n is number of possible tags)
// - xx / 50 points for each nfxx tag (since they go up to 50)
function _getPreferredReading(entry: JmdictEntry): string {

    const [prefK, scoreK] = getPreferredKeleWithScore(entry);
    const [prefR, scoreR] = getPreferredReleWithScore(entry);

    if (prefR && isUsuallyKana(entry)) {
        return prefR;
    }

    if ((scoreK > scoreR) && prefK) {
        return prefK;
    }
    else if ((scoreK < scoreR) && prefR) {
        return prefR;
    }
    // Scores are equal
    else {
        if (prefK) return prefK;
        return prefR as string;
    }
}

export function getPreferredReading(entry: JmdictEntry): string {
    if (entry.cachedPreferredReading != '') {
        return entry.cachedPreferredReading;
    }
    const val = _getPreferredReading(entry);
    entry.cachedPreferredReading = val;
    return val;
}

export function getReadings(entry: JmdictEntry): string[] {
    return [
        ...entry.k_ele.map(kele => kele.keb), 
        ...entry.r_ele.map(rele => rele.reb)
    ];
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
        await jmdict.parse(filePath);
        return jmdict;
    }

    async parse(filePath: string): Promise<void> {
        const serializeKele = (el: JME_Kele): JmdictKele => {
            const kele = makeDefaultKele();
            for (const child of el.children) {
                if (child.tagName == 'keb') kele.keb = child.children[0];
                else if (child.tagName == 'ke_pri') kele.ke_pri.push(child.children[0]);
                else if (child.tagName == 'ke_inf') kele.ke_inf.push(child.children[0]);
            }
            return kele;
        };
        const serializeRele = (el: JME_Rele): JmdictRele => {
            const rele = makeDefaultRele();
            for (const child of el.children) {
                if (child.tagName == 'reb') rele.reb = child.children[0];
                else if (child.tagName == 're_pri') rele.re_pri.push(child.children[0]);
                else if (child.tagName == 're_inf') rele.re_inf.push(child.children[0]);
            }
            return rele;
        };
        const serializeGloss = (el: JME_Gloss): JmdictGloss => {
            const gloss = makeDefaultGloss();
            gloss.lang = el.attributes?.['xml:lang'] || JmdictGlossLang.eng;
            gloss.text = el.children[0];
            return gloss;
        };
        const serializeSense = (el: JME_Sense): JmdictSense => {
            const sense = makeDefaultSense();
            for (const child of el.children) {
                if (child.tagName == 'pos') sense.pos.push(child.children[0]);
                else if (child.tagName == 'gloss') sense.gloss.push(
                    serializeGloss(child)
                );
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
                this.emplaceEntry(entry);
            }
        };

        const onDtd = (e: XMLDtdDecl) => {
            if (e.tagName == '!ENTITY') {
                this.emplaceEntity(e.key, e.value);
            }
        }

        const handlers: XMLParserProps<keyof JmdictTagType, keyof JmdictAttrKey> = {
            skipRoot: false,
            onDtdDecl: onDtd,
            onElement: onElement,
        };

        await xmlparser.parseXML<keyof JmdictTagType, keyof JmdictAttrKey>(filePath, handlers);
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

    public interpretEntity(key: string, interpretParens?: false): string {
        const match = key.match(/&[a-zA-Z0-9-]+;/);
        if (!match || match[0] != key) {
            return key;
        }
        return this.m_entityAbbrev[match[0].substring(1, match[0].length - 1)] || key;
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
            this.emplaceWord(keb, entry.ent_seq);
        })
        entry.r_ele.forEach(({ reb }) => {
            this.emplaceWord(reb, entry.ent_seq);
        })
    }

    public getSeqsByChar(char: string): number[] {
        return this.m_charToSeqs.get(char) || [];
    }

    // Return a list of entries that have the given char in its preferred reading
    public getPreferredEntriesByChar(char: string): JmdictEntry[] {
        const seqs = this.getSeqsByChar(char);
        const entries = seqs.map(el => this.getEntryBySeq(el)).filter(e => !!e);
        return entries.filter(e => getPreferredReading(e).includes(char));
    }

    private emplaceWord(word: string, ent_seq: number) {
        // Emplace words
        const wordArr = this.m_wordToSeq.get(word);
        if (!wordArr) this.m_wordToSeq.set(word, [ent_seq]);
        else if (!wordArr.includes(ent_seq)) wordArr.push(ent_seq);

        // Emplace characters

        for (const char of word) {
            if (!isHanCharacter(char)) continue;
            const arr = this.m_charToSeqs.get(char);
            if (!arr) {
                this.m_charToSeqs.set(char, [ent_seq]);
            }
            else if (!arr.includes(ent_seq)) arr.push(ent_seq);
        }
    }

    public getEntriesByWord(text: string): JmdictEntry[] {
        const seqs = this.m_wordToSeq.get(text);
        if (seqs == undefined) return [];
        return seqs.map(seq => this.m_entries.get(seq)).filter(e => !!e);
    }

    public getEntryBySeq(seq: number): JmdictEntry | undefined {
        return this.m_entries.get(seq);
    }

    public getAbbrevs(): Readonly<Record<string, string>> {
        return this.m_entityAbbrev;
    };

    // Index of characters to dictionary words (by seq)
    private m_charToSeqs: Map<string, number[]> = new Map();

    // Entity abbreviations
    private m_entityAbbrev: Record<string, string> = {};

    // Index of k_ele to ent seq
    // private m_kEleToSeq: Map<string, number> = new Map();
    // Index of r_ele to ent seq
    // private m_rEleToSeq: Map<string, number> = new Map();
    // Index of word to ent seq
    private m_wordToSeq: Map<string, number[]> = new Map();
    // Dictionary entries indexed by entry seq
    private m_entries: Map<number, JmdictEntry> = new Map();
}