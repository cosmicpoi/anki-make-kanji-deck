import * as fs from 'fs'
import * as readline from 'readline';
import autoBind from "auto-bind";

enum XMLAttrKey {
    xml_lang = "xml:lang",
};

type XMLAttributeObj = Partial<{
    [k in XMLAttrKey]: string;
}>;

type XMLTagType = 'declaration' | 'comment' | 'doctype';

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

        const tryPopTag = (tagType: XMLTagType): void => {
            const tag = openingTags.pop();
            if (!(tag?.type == tagType)) {
                console.error('Could not find a comment closing tag');
                return undefined;
            }
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
            const match_commentWholeLine = line.match(/^<!--.+-->$/);
            if (match_commentWholeLine) {
                continue;
            }

            const prevTag = openingTags.length != 0 ? openingTags[openingTags.length - 1] : undefined;
            if (prevTag?.type == 'comment') {
                const match_commentEnd = line.match(/-->\s*$/);
                if (match_commentEnd) {
                    tryPopTag('comment');
                    continue;
                }
                else {
                    continue;
                }
            }
            else if (prevTag?.type == 'doctype') {
                const match_doctypeEnd = line.match(/^\]>$/);
                if (match_doctypeEnd) {
                    tryPopTag('doctype');
                    console.log("End doctype");
                    continue;
                }
                const match_doctypeEntry = line.match(/^<!(.+)>$/);
                const match_entity = line.match(/^<!ENTITY (.+) "(.+)">$/);
                if (match_doctypeEntry) {
                    const parts = match_doctypeEntry[1].split(" ");
                    const entryType = parts[0] as DoctypeEntryType;
                    if (entryType == 'ENTITY')
                    {
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

                // const match_linetag = line.match(/^<(.+?)\/>$/);
                // if (match_linetag) {
                //     continue;
                // }

                // const match_opentag = line.match(/^<(.+?)>$/);
                // if (match_opentag) {
                //     const [tagType, tagAttrs] = getTagAttrsFromStripped(match_opentag[1]);

                //     console.log(as_xml_props(tagType, tagAttrs));
                //     // openingTags.push(as_xml_props(tagType, tagAttrs));
                //     continue;
                // }

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