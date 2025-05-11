import * as fs from 'fs'
import { buffer } from 'stream/consumers';

type XMLAttrKey = string; // enum-like
type XMLTagName = string;
type XMLAttrObj = Partial<Record<XMLAttrKey, string>>;

// Represents an XML opening tag
type XMLTagProps = {
    source?: string;
    tagName: XMLTagName;
    attributes?: XMLAttrObj;
};


type ParamXMLAttrObj<PAttrKey extends XMLAttrKey> =
    XMLAttrObj & Partial<Record<keyof PAttrKey, string>>;

// Represents an XML opening tag with a schema
type ParamXMLTagProps<
    PTagName extends XMLTagName,
    PAttrKey extends XMLAttrKey
> = XMLTagProps & {
    source?: string;
    tagName: PTagName;
    attributes?: ParamXMLAttrObj<PAttrKey>;
}

// Convert `type` tag with props to XMLProps struct
const as_xml_props = (
    tagName: string,
    attributes: XMLAttrObj | undefined = undefined,
    source: string | undefined = undefined
): XMLTagProps => {
    const props: XMLTagProps = { tagName };
    if (attributes) props.attributes = attributes;
    if (source) props.source = source;

    return props;
}

type XMLElement = XMLTagProps & {
    children: (XMLElement | 'string' | 'number')[]
};

type ParamXMLElement<
    PTagName extends XMLTagName,
    PAttrKey extends XMLAttrKey
> = ParamXMLTagProps<PTagName, PAttrKey> & {
    children: (XMLElement | 'string' | 'number')[]
};

type XMLParserHandlerObj = {

};

// Function handlers for `parseXML` - basically a function for each tag type
// type XMLHandlerObj =

const k_BUF_MAX_SIZE = 1024 * 64;
export async function parseXML<
    PTagName extends XMLTagName = XMLTagName,
    PAttrKey extends XMLAttrKey = XMLAttrKey
>(filePath: string): Promise<void> {
    // Types
    type PTagProps = ParamXMLTagProps<PTagName, PAttrKey>;
    type PAttrObj = ParamXMLAttrObj<PAttrKey>;

    // Helper functions
    // Take a stripped start tag (A for <A> or <A/ >) and get its attrs
    function getTagAttrsFromStripped(stripped: string): [PTagName, PAttrObj | undefined] {
        let tagType = stripped;
        const tagAttrs: PAttrObj = {};
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
        return [tagType as PTagName, attrs];
    }

    // Create filestream
    const fileStream = fs.createReadStream(filePath);
    // const fileStream = fs.createReadStream(filePath);

    const stream = fs.createReadStream(filePath, {
        // highWaterMark: 1024,
        encoding: 'utf-8',
    });

    // Allocate buffers: token, string, element
    type POpenToken = PTagProps | '<' | '<!DOCTYPE';
    type PCloseToken = { tagName: PTagName } | '>' | ']>';

    const prevTokens: POpenToken[] = [];

    const strBuffer = new Array(k_BUF_MAX_SIZE).fill('\0');
    let strBufferLength: number = 0;

    let currElement: XMLElement | undefined = undefined;

    // Token and buffer handlers
    const getPrevToken = (): POpenToken | undefined =>
        prevTokens.length != 0 ? prevTokens[prevTokens.length - 1] : undefined;
    const isMatchedPair = (t1: POpenToken, t2: PCloseToken): boolean => {
        if (t1 == '<' && t2 == '>') return true;
        if (t1 == '<!DOCTYPE' && t2 == ']>') return true;
        if (typeof t1 != 'object' || typeof t2 != 'object') return false;
        if (t1.tagName == t2.tagName) return true;
        return false;
    }

    const tryPopToken = (match?: PCloseToken): boolean => {
        const prevToken = prevTokens.pop();
        if (!prevToken) {
            console.error('Prev token is undefined');
            return false;
        }
        if (match && !isMatchedPair(prevToken, match)) {
            console.error('Could not match tokens', prevToken, match);
            return false;
        }
        console.log('popped token', match);
        return true;
    }
    const pushToken = (token: POpenToken): void => {
        console.log("Pushed token", token);
        prevTokens.push(token)
    };

    const bufferCharacter = (nextChar: string) => {
        strBuffer[strBufferLength++] = nextChar;
    }

    const flushCharBuffer = (): string => {
        const slice: string[] = strBuffer.slice(0, strBufferLength);
        const res = slice.join('');

        strBuffer.fill('\0', 0, strBufferLength);
        strBufferLength = 0;

        return res;
    }

    const handleTag = (withoutBrackets: string) => {
        let stripped = withoutBrackets;
        const hasFrontSlash: boolean = stripped.at(0) == '/';
        if (hasFrontSlash) {
            stripped = stripped.substring(1);
        }
        const hasBackSlash: boolean = stripped.at(-1) == '/';
        if (hasBackSlash) {
            stripped = stripped.slice(0, -1);
        }

        const prevToken = getPrevToken();
        if (typeof prevToken == 'string') {
            throw "Invalid token";
        }

        const [tagName, tagAttrs] = getTagAttrsFromStripped(stripped);
        const isEndTag: boolean = hasFrontSlash && (prevToken?.tagName == tagName);

        // End tag
        if (isEndTag) {
            if (!tryPopToken({ tagName })) throw "Could not pop tag";
        }
        // Self-closing tag
        else if (hasBackSlash) {

        }
        // Start tag
        else if (!hasFrontSlash && !hasBackSlash) {
            pushToken({ tagName, attributes: tagAttrs });
        }
        else {
            throw "handleTag error: Something weird happened";
        }
    }

    // File parsing logic
    stream.on('data', (chunk) => {
        try {
            for (const char of chunk as string) {
                const prevToken = getPrevToken();
                if (prevToken == '<') {
                    if (char == '>') {
                        const tagContents = flushCharBuffer();
                        if (!tryPopToken('>')) throw new Error();
                        handleTag(tagContents);
                    }
                    else {
                        bufferCharacter(char);
                    }
                }
                else {
                    if (char == '<') {
                        pushToken('<');
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    });
}