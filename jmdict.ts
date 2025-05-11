import * as fs from 'fs'
import * as readline from 'readline';
import autoBind from "auto-bind";

enum XMLAttrKey {
    xml_lang = "xml:lang",
};

type XMLAttributeObj = Partial<{
    [k in XMLAttrKey]: string;
}>;

type XMLTagType = 'declaration' | 'comment' | 'doctype'
    | 'r_ele' | 'k_ele' | 'sense' | 'entry' | 'ent_seq' | 'keb' | 'reb' | 'pos' | 'gloss';

type DoctypeEntryType = 'ENTITY' | 'ELEMENT' | 'ATTLIST';

// Represents an XML opening tag
type XMLProps = {
    source?: string;
    type: XMLTagType;
    attributes?: XMLAttributeObj;
}

const as_xml_props = (
    type: XMLTagType,
    attributes: XMLAttributeObj | undefined = undefined,
    source: string | undefined = undefined
): XMLProps => {
    const props: XMLProps = { type };
    if (attributes) props.attributes = attributes;
    if (source) props.source = source;

    return props;
}

type XMLEntity = {
    source?: string;
    key: string;
    value: string;
};

// type XMLElement = {
//     type: 'comment' | 'text' | 'element';
//     // name: XMLName;
//     content: XMLElement[] | string;
//     attributes?: XMLAttributeObj;
// };

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
};
type JmdictKele = {
    keb: string;
    ke_pri: string[];
}
type JmdictRele = {
    reb: string;
    re_pri: string[];
}
type JmdictEntry = {
    ent_seq: number; // ent_seq
    k_ele: JmdictKele[]; // k_ele
    r_ele: JmdictRele[]; // r_ele
    sense: JmdictSense[]; // sense
};

const k_ENT_SEQ_INVALID = -1;
const make_default_entry = (): JmdictEntry => ({
    ent_seq: k_ENT_SEQ_INVALID,
    k_ele: [],
    r_ele: [],
    sense: [],
});

export class Jmdict {
    constructor() {
        autoBind(this);
    }
    static async create(filePath: string): Promise<Jmdict | undefined> {
        const jmdict = new Jmdict();

        const fileStream = fs.createReadStream(filePath);
        // const fileStream = fs.createReadStream(filePath);

        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity, // Recognize all instances of CR LF ('\r\n') as a single line break
        });

        // Take a stripped start tag (A for <A> or <A/>) and get its attrs
        const getTagAttrsFromStripped = (stripped: string): [XMLTagType, XMLAttributeObj | undefined] => {
            let tagType = stripped;
            const tagAttrs: XMLAttributeObj = {};
            let hasAttrs = false;
            if (stripped.includes('=')) {
                const parts = stripped.split(' ');
                // has props, need to unpack them
                tagType = parts[0];
                for (let i = 1; i < parts.length; i++) {
                    const attrSrc = parts[i];
                    const kv = attrSrc.split("=");
                    const attrKey = kv[0];
                    const attrVal = kv[1].slice(1, -1);

                    // @ts-ignore
                    tagAttrs[attrKey] = attrVal;
                    hasAttrs = true;
                }
            }
            const attrs = hasAttrs ? tagAttrs : undefined;
            return [tagType as XMLTagType, attrs];
        }


        const openingTags: XMLProps[] = [];
        const entities: XMLEntity[] = [];

        const getPrevTag = (): XMLProps | undefined =>
            openingTags.length != 0 ? openingTags[openingTags.length - 1] : undefined;

        const tagInRoot = (tagType: XMLTagType): boolean =>
            openingTags.map(t => t.type).includes(tagType);

        let currentEntry: JmdictEntry | undefined = undefined;

        const onPopTag = (tagType: XMLTagType) => {
            if (!currentEntry) return;
            if (tagType == 'entry') {
                // console.log('Popping and emplacing entry');
                jmdict.emplaceEntry(currentEntry);
                currentEntry = undefined;
            }
        }

        const onPushTag = (tagType: XMLTagType, tagAttrs: XMLAttributeObj | undefined) => {
            if (tagType == 'entry') {
                // console.log('Making new entry');
                currentEntry = make_default_entry();
            }
        }

        const pushTagWithValue = (tagType: XMLTagType, text: string, tagAttrs: XMLAttributeObj | undefined) => {
            // console.log('Pushing tag with value ', tagType, text);
            const prevTag = getPrevTag();
            if (tagInRoot('entry')) {
                if (!currentEntry) {
                    console.error("Current entry invalid");
                    return;
                }

                if (tagType == 'ent_seq') {
                    currentEntry.ent_seq = parseInt(text);
                }
                else if (tagType == 'keb') {
                    // console.log('Adding keb', text);
                    if (prevTag?.type != 'k_ele') {
                        console.error("Root invalid");
                        return;
                    }
                    currentEntry.k_ele.push({ keb: text, ke_pri: [] });
                }
                else if (tagType == 'reb') {
                    // console.log('Adding reb', text);
                    if (prevTag?.type != 'r_ele') {
                        console.error("Root invalid");
                        return;
                    }
                    currentEntry.r_ele.push({ reb: text, re_pri: [] });
                }
            }
        }

        const tryPopTag = (tagType: XMLTagType): boolean => {
            const tag = openingTags.pop();
            if (!(tag?.type == tagType)) {
                console.error('Could not find a closing tag for ', tagType);
                return false;
            }
            // console.log("popped", tagType);
            onPopTag(tagType);
            return true;
        }

        const pushTag = (tagType: XMLTagType, tagAttrs: XMLAttributeObj | undefined) => {
            openingTags.push(as_xml_props(tagType, tagAttrs));
            onPushTag(tagType, tagAttrs);
        }



        for await (const line of rl) {
            const isDeclaration = line.substring(0, 5) == '<?xml';
            if (isDeclaration) {
                continue;
            }

            const match_commentWholeLine = line.match(/^<!--.+-->$/);
            if (match_commentWholeLine) {
                continue;
            }

            const prevTag = getPrevTag();
            if (prevTag?.type == 'comment') {
                const match_commentEnd = line.match(/-->\s*$/);
                if (match_commentEnd) {
                    if (!tryPopTag('comment')) return;
                    continue;
                }
                else {
                    continue;
                }
            }

            const match_commentStart = line.match(/^\s*<!--.*$/);
            if (match_commentStart) {
                openingTags.push({ source: '<!--', type: 'comment' });
                continue;
            }

            if (prevTag?.type == 'doctype') {
                const match_doctypeEnd = line.match(/^\]>$/);
                if (match_doctypeEnd) {
                    if (!tryPopTag('doctype')) return;
                    continue;
                }
                const match_doctypeEntry = line.match(/^<!(.+)>$/);
                const match_entity = line.match(/^<!ENTITY (.+) "(.+)">$/);
                if (match_doctypeEntry) {
                    const parts = match_doctypeEntry[1].split(" ");
                    const entryType = parts[0] as DoctypeEntryType;
                    if (entryType == 'ENTITY') {
                        entities.push({ key: parts[1], value: parts[2] });
                    }
                    continue;
                }

            }
            else {
                const match_doctypeStart = line.match(/^<!DOCTYPE JMdict \[$/);
                if (match_doctypeStart) {
                    openingTags.push({ type: 'doctype' });
                    continue;
                }

                const match_tags = line.match(/<(.+?)>/g);
                if (match_tags) {
                    if (match_tags.length == 2) {
                        const capture = line.match(/<(.+?)>(.+?)<\/.+>/);
                        if (capture) {
                            const stripped = capture[1];
                            const [tagType, tagAttrs] = getTagAttrsFromStripped(stripped);

                            const text = capture[2];
                            pushTagWithValue(tagType, text, tagAttrs);
                        }
                        continue;
                    }
                    else if (match_tags.length == 1) {
                        let stripped = match_tags[0].slice(1, -1);

                        const hasFrontSlash: boolean = stripped.at(0) == '/';
                        if (hasFrontSlash) {
                            stripped = stripped.substring(1);
                        }
                        const hasBackSlash: boolean = stripped.at(-1) == '/';
                        if (hasBackSlash) {
                            stripped = stripped.slice(0, -1);
                        }

                        const [tagType, tagAttrs] = getTagAttrsFromStripped(stripped);
                        const isEndTag: boolean = hasFrontSlash && (prevTag?.type == tagType);

                        // end tag
                        if (isEndTag) {
                            // console.log("popping tag: ", tagType, tagAttrs, line);
                            if (!tryPopTag(stripped as XMLTagType)) return;
                            continue;
                        }
                        // one-line tag
                        else if (hasBackSlash) {
                            // console.log("one-line tag:", tagType, tagAttrs, line);
                        }
                        // start tag
                        else if (!hasFrontSlash && !hasBackSlash) {
                            // console.log("pushing tag: ", tagType, tagAttrs, line);
                            pushTag(tagType, tagAttrs);

                            continue;
                        }
                        else {
                            console.error("Something weird happened");
                            return undefined;
                        }
                    }
                    else { // (match_tags.length > 2)
                        console.error("We don't know how to handle this line", line);
                        return undefined;
                    }

                    continue;
                }
            } 
        }

        if (openingTags.length != 0) {
            console.error("Tree parse error");
            return undefined;
        }

        return jmdict;
    }

    public doThing(): void {

    };

    public forEachWord(handler: (word: string) => void) {
        for (const tup of this.m_wordToSeq) {
            const [key] = tup;
            handler(key);
        }
    }


    private emplaceEntry(entry: JmdictEntry): void {
        // if ( Math.random() < 0.001) console.log("Emplacing entry:", entry);
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
        entry.r_ele.forEach(({reb}) => {
            // this.m_rEleToSeq.set(reb, entry.ent_seq);
            this.m_wordToSeq.set(reb, entry.ent_seq);
        })

    }

    // Index of k_ele to ent seq
    private m_kEleToSeq: Map<string, number> = new Map();
    // Index of r_ele to ent seq
    private m_rEleToSeq: Map<string, number> = new Map();
    // Index of word to ent seq
    private m_wordToSeq: Map<string, number> = new Map();
    // Dictionary entries indexed by entry seq
    private m_entries: Map<number, JmdictEntry> = new Map();
}