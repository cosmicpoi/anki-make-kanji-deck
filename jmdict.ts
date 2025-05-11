import * as fs from 'fs'
import * as readline from 'readline';
import autoBind from "auto-bind";

enum XMLAttrKey {
    xml_lang = "xml:lang",
};

type XMLAttributeObj = Partial<{
    [k in XMLAttrKey]: string;
}>;

type XMLTagType = 'declaration' | 'comment' | 'doctype' | 'r_ele' | 'sense' | 'entry';

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

type JmdictEntry = {

};

export class Jmdict {
    constructor() {
        autoBind(this);
    }
    static async create(filePath: string): Promise<Jmdict | undefined> {
        const fileStream = fs.createReadStream(filePath);
        // const fileStream = fs.createReadStream(filePath);

        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity, // Recognize all instances of CR LF ('\r\n') as a single line break
        });

        const openingTags: XMLProps[] = [];
        const entities: XMLEntity[] = [];


        const tryPopTag = (tagType: XMLTagType): boolean => {
            const tag = openingTags.pop();
            if (!(tag?.type == tagType)) {
                console.error('Could not find a closing tag for ', tagType);
                return false;
            }
            return true;
        }

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

        for await (const line of rl) {
            const isDeclaration = line.substring(0, 5) == '<?xml';
            if (isDeclaration) {
                continue;
            }

            const match_commentWholeLine = line.match(/^<!--.+-->$/);
            if (match_commentWholeLine) {
                continue;
            }

            const prevTag = openingTags.length != 0 ? openingTags[openingTags.length - 1] : undefined;
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
            else if (prevTag?.type == 'doctype') {
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
                const match_commentStart = line.match(/^\s*<!--.*$/);
                if (match_commentStart) {
                    openingTags.push({ source: '<!--', type: 'comment' });
                    continue;
                }

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
                            // const tagType = capture[1];
                            // const text = capture[2];
                        }
                        continue;
                    }
                    else if (match_tags.length == 1) {
                        let stripped = match_tags[0].slice(1, -1);

                        const hasFrontSlash: boolean = stripped.at(0) == '/';
                        if ( hasFrontSlash ) {
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
                        else if (!hasFrontSlash && !hasBackSlash){
                            const stripped = match_tags[0].slice(1, -1);
                            const [tagType, tagAttrs] = getTagAttrsFromStripped(stripped);
                            // console.log("pushing tag: ", tagType, tagAttrs, line);
                            openingTags.push(as_xml_props(tagType, tagAttrs))

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


                // const match_jmdictEnd = line.match(/^<\/JMdict>$/);
                // if (match_jmdictEnd) {
                //     if (prevTag?.type == 'jmdict') {

                //         continue;
                //     }
                // }
            }

            // Process the line here
            // console.log(line);
        }


        // const res = xml_convert.xml2js(content);
        // console.log(res);

        return new Jmdict();
    }

    public doThing(): void {

    };



    // Dictionary entries indexed by traditional chinese
    private m_entries: Map<string, JmdictEntry> = new Map();
}